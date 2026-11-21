import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MouseConnection,
  MouseGripChoice,
  MouseHandSizeChoice,
  MousePollingHz,
  MouseShape,
  MouseSpec,
  MouseSwitchType,
  SpringType,
  SwitchCategory,
  SwitchPitchChoice,
  SwitchSpec,
  VerifiedTelemetryLog,
} from "@/types/specs";

interface SwitchDbRow {
  id: string;
  slug: string;
  name: string;
  name_en: string;
  brand: string;
  category: string;
  operating_force_gf: number;
  bottom_out_force_gf: number | null;
  pre_travel_mm: number;
  total_travel_mm: number;
  spring_length_mm: number | null;
  spring_type: string | null;
  material_top: string;
  material_bottom: string;
  material_stem: string;
  factory_lubed: boolean;
  pins: number;
  color_top_hex: string;
  color_bottom_hex: string;
  color_stem_hex: string;
}

interface MouseDbRow {
  id: string;
  slug: string;
  name: string;
  name_en: string;
  brand: string;
  max_polling_hz: number;
  connection: string;
  shape: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_grams: number;
  sensor: string;
  switch_type: string;
  switch_model: string;
  color_accent_hex: string;
}

interface SpecVoteDbRow {
  id: string;
  user_id: string;
  kind: "switch" | "mouse";
  device_id: string;
  rating: number;
  pitch: SwitchPitchChoice | null;
  grip: MouseGripChoice | null;
  hand_size: MouseHandSizeChoice | null;
  one_line_review: string | null;
  updated_at: string;
}

function formatIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Supabase `switches`, `mice`, `spec_votes` 테이블에서 도감 데이터를 서버 측 조회
 * - 현재 로그인 유저의 표는 클라이언트 `spec-verification` 스토어에서 실시간 반영하므로
 *   서버 기준 집계에서는 제외해 이중 합산 방지
 */
export async function fetchCatalogSpecsFromSupabase(): Promise<{
  switches: SwitchSpec[];
  mice: MouseSpec[];
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { switches: INITIAL_SWITCHES, mice: INITIAL_MICE };
  }

  try {
    const [
      { data: authData },
      { data: switchRows, error: swErr },
      { data: mouseRows, error: msErr },
      { data: voteRows },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("switches").select("*").order("created_at", { ascending: true }),
      supabase.from("mice").select("*").order("created_at", { ascending: true }),
      supabase
        .from("spec_votes")
        .select(
          "id, user_id, kind, device_id, rating, pitch, grip, hand_size, one_line_review, updated_at"
        )
        .order("updated_at", { ascending: false }),
    ]);

    if (swErr || msErr || !switchRows?.length || !mouseRows?.length) {
      return { switches: INITIAL_SWITCHES, mice: INITIAL_MICE };
    }

    const currentUserId = authData.user?.id ?? null;
    const otherVotes = ((voteRows ?? []) as SpecVoteDbRow[]).filter(
      (v) => v.user_id !== currentUserId
    );

    const baseSwitchMap = new Map(INITIAL_SWITCHES.map((s) => [s.id, s]));
    const baseMouseMap = new Map(INITIAL_MICE.map((m) => [m.id, m]));

    const switches: SwitchSpec[] = (switchRows as SwitchDbRow[]).map((row) => {
      const seedFallback = baseSwitchMap.get(row.id);
      const baseComm = seedFallback?.community ?? {
        ratingAvg: 0,
        reviewCount: 0,
        pitchVotes: { low: 0, mid: 0, high: 0 },
        telemetryLogs: [],
      };

      const deviceVotes = otherVotes.filter(
        (v) => v.kind === "switch" && v.device_id === row.id
      );

      let ratingSum = baseComm.ratingAvg * baseComm.reviewCount;
      let reviewCount = baseComm.reviewCount;
      const pitchVotes = { ...baseComm.pitchVotes };
      const extraLogs: VerifiedTelemetryLog[] = [];

      for (const v of deviceVotes) {
        ratingSum += v.rating;
        reviewCount += 1;
        if (v.pitch && v.pitch in pitchVotes) {
          pitchVotes[v.pitch] += 1;
        }
        const trimmed = v.one_line_review?.trim();
        if (trimmed) {
          extraLogs.push({
            id: `db-vote-${v.id}`,
            createdAt: formatIsoDate(v.updated_at),
            rating: v.rating,
            structuredSummary: trimmed,
            badgeText: "테스트 인증",
            badgeTone: "sand",
          });
        }
      }

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        nameEn: row.name_en,
        brand: row.brand,
        category: row.category as SwitchCategory,
        operatingForceGf: Number(row.operating_force_gf),
        bottomOutForceGf:
          row.bottom_out_force_gf !== null
            ? Number(row.bottom_out_force_gf)
            : null,
        preTravelMm: Number(row.pre_travel_mm),
        totalTravelMm: Number(row.total_travel_mm),
        springLengthMm:
          row.spring_length_mm !== null ? Number(row.spring_length_mm) : null,
        springType: (row.spring_type as SpringType) ?? null,
        materials: {
          top: row.material_top,
          bottom: row.material_bottom,
          stem: row.material_stem,
        },
        factoryLubed: row.factory_lubed,
        pins:
          row.pins === 0 || row.pins === 2 || row.pins === 3 || row.pins === 5
            ? row.pins
            : 5,
        colorway: {
          topHex: row.color_top_hex,
          bottomHex: row.color_bottom_hex,
          stemHex: row.color_stem_hex,
        },
        community: {
          ratingAvg:
            reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : 0,
          reviewCount,
          pitchVotes,
          telemetryLogs: [...extraLogs, ...baseComm.telemetryLogs],
        },
      };
    });

    const mice: MouseSpec[] = (mouseRows as MouseDbRow[]).map((row) => {
      const seedFallback = baseMouseMap.get(row.id);
      const baseComm = seedFallback?.community ?? {
        ratingAvg: 0,
        reviewCount: 0,
        gripVotes: { palm: 0, claw: 0, finger: 0 },
        handSizeVotes: { f1_f8: 0, f9: 0, f10: 0, f11_plus: 0 },
        telemetryLogs: [],
      };

      const deviceVotes = otherVotes.filter(
        (v) => v.kind === "mouse" && v.device_id === row.id
      );

      let ratingSum = baseComm.ratingAvg * baseComm.reviewCount;
      let reviewCount = baseComm.reviewCount;
      const gripVotes = { ...baseComm.gripVotes };
      const handSizeVotes = { ...baseComm.handSizeVotes };
      const extraLogs: VerifiedTelemetryLog[] = [];

      for (const v of deviceVotes) {
        ratingSum += v.rating;
        reviewCount += 1;
        if (v.grip && v.grip in gripVotes) {
          gripVotes[v.grip] += 1;
        }
        if (v.hand_size && v.hand_size in handSizeVotes) {
          handSizeVotes[v.hand_size] += 1;
        }
        const trimmed = v.one_line_review?.trim();
        if (trimmed) {
          extraLogs.push({
            id: `db-vote-${v.id}`,
            createdAt: formatIsoDate(v.updated_at),
            rating: v.rating,
            structuredSummary: trimmed,
            badgeText: "테스트 인증",
            badgeTone: "sand",
          });
        }
      }

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        nameEn: row.name_en,
        brand: row.brand,
        maxPollingHz: row.max_polling_hz as MousePollingHz,
        connection: row.connection as MouseConnection,
        shape: row.shape as MouseShape,
        dimensionsMm: {
          length: Number(row.length_mm),
          width: Number(row.width_mm),
          height: Number(row.height_mm),
        },
        weightGrams: Number(row.weight_grams),
        sensor: row.sensor,
        switchType: row.switch_type as MouseSwitchType,
        switchModel: row.switch_model,
        colorAccentHex: row.color_accent_hex,
        community: {
          ratingAvg:
            reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : 0,
          reviewCount,
          gripVotes,
          handSizeVotes,
          telemetryLogs: [...extraLogs, ...baseComm.telemetryLogs],
        },
      };
    });

    return { switches, mice };
  } catch {
    return { switches: INITIAL_SWITCHES, mice: INITIAL_MICE };
  }
}
