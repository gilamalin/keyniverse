#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SWITCHES_JSON_PATH = path.join(ROOT, "data", "specs", "switches.json");
const MICE_JSON_PATH = path.join(ROOT, "data", "specs", "mice.json");
const SEED_COMMUNITY_PATH = path.join(ROOT, "data", "specs", "seed-community.json");
const OUT_SQL_PATH = path.join(ROOT, "supabase", "seed.sql");
const OUT_TS_PATH = path.join(ROOT, "src", "data", "specs-data.ts");

const VALID_SWITCH_CATEGORIES = new Set([
  "linear",
  "tactile",
  "silent_linear",
  "silent_tactile",
  "clicky",
  "electro_capacitive",
  "magnetic",
]);
const VALID_SWITCH_PINS = new Set([0, 2, 3, 5]);
const VALID_SPRING_TYPES = new Set([null, "1단", "2단", "3단"]);
const VALID_POLLING_HZ = new Set([1000, 2000, 4000, 8000]);
const VALID_CONNECTIONS = new Set(["wireless_wired", "wired"]);
const VALID_SHAPES = new Set(["symmetrical", "ergonomic"]);
const VALID_MOUSE_SWITCH_TYPES = new Set(["optical", "mechanical"]);
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED_ORIGINAL_SWITCH_IDS = [
  "sw-hmx-hyacinth-v2u",
  "sw-hmx-cheese",
  "sw-bsun-rosewood",
  "sw-gateron-oil-king",
  "sw-cherry-mx2a-black",
  "sw-gazzew-boba-u4t",
  "sw-outemu-silent-peach-v3",
  "sw-outemu-silent-lime-v3",
  "sw-kailh-box-jade",
  "sw-wooting-lekker-l45-v2",
  "sw-gateron-magnetic-jade",
];

const REQUIRED_ORIGINAL_MOUSE_IDS = [
  "ms-razer-viper-v3-pro",
  "ms-logitech-gpx-superlight-2",
  "ms-razer-deathadder-v3-pro",
  "ms-wlmouse-beast-x-max",
  "ms-lamzu-maya-x-8k",
  "ms-atk-f1-ultimate",
  "ms-endgame-gear-op1-8k",
  "ms-pulsar-x2v2-mini",
  "ms-vaxee-xe-s-wireless",
  "ms-zowie-u2",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sqlStr(val) {
  if (val === null || val === undefined) return "null";
  return `'${String(val).replace(/'/g, "''")}'`;
}

function sqlNum(val) {
  if (val === null || val === undefined) return "null";
  return String(val);
}

function validateSwitches(switches) {
  const errors = [];
  const ids = new Set();
  const slugs = new Set();

  switches.forEach((sw, idx) => {
    const label = `switches[${idx}] (${sw.id ?? "unknown"})`;
    if (!sw.id || typeof sw.id !== "string") errors.push(`${label}: invalid id`);
    else if (ids.has(sw.id)) errors.push(`${label}: duplicate id`);
    else ids.add(sw.id);

    if (!sw.slug || !SLUG_REGEX.test(sw.slug)) errors.push(`${label}: invalid slug "${sw.slug}"`);
    else if (slugs.has(sw.slug)) errors.push(`${label}: duplicate slug "${sw.slug}"`);
    else slugs.add(sw.slug);

    if (!sw.name || !sw.nameEn || !sw.brand) errors.push(`${label}: missing name/nameEn/brand`);
    if (!VALID_SWITCH_CATEGORIES.has(sw.category)) errors.push(`${label}: invalid category "${sw.category}"`);
    if (typeof sw.operatingForceGf !== "number" || sw.operatingForceGf < 15 || sw.operatingForceGf > 100) {
      errors.push(`${label}: operatingForceGf out of range (${sw.operatingForceGf})`);
    }
    if (sw.bottomOutForceGf !== null && (typeof sw.bottomOutForceGf !== "number" || sw.bottomOutForceGf < 20 || sw.bottomOutForceGf > 120)) {
      errors.push(`${label}: bottomOutForceGf out of range (${sw.bottomOutForceGf})`);
    }
    if (typeof sw.preTravelMm !== "number" || sw.preTravelMm < 0.1 || sw.preTravelMm > 3.5) {
      errors.push(`${label}: preTravelMm out of range (${sw.preTravelMm})`);
    }
    if (typeof sw.totalTravelMm !== "number" || sw.totalTravelMm < 2.0 || sw.totalTravelMm > 5.0) {
      errors.push(`${label}: totalTravelMm out of range (${sw.totalTravelMm})`);
    }
    if (sw.preTravelMm > sw.totalTravelMm) {
      errors.push(`${label}: preTravelMm (${sw.preTravelMm}) > totalTravelMm (${sw.totalTravelMm})`);
    }
    if (sw.springLengthMm !== null && (typeof sw.springLengthMm !== "number" || sw.springLengthMm < 10 || sw.springLengthMm > 30)) {
      errors.push(`${label}: springLengthMm out of range (${sw.springLengthMm})`);
    }
    if (!VALID_SPRING_TYPES.has(sw.springType)) {
      errors.push(`${label}: invalid springType "${sw.springType}"`);
    }
    if (!sw.materials?.top || !sw.materials?.bottom || !sw.materials?.stem) {
      errors.push(`${label}: missing materials`);
    }
    if (typeof sw.factoryLubed !== "boolean") errors.push(`${label}: factoryLubed must be boolean`);
    if (!VALID_SWITCH_PINS.has(sw.pins)) errors.push(`${label}: invalid pins (${sw.pins})`);
    for (const key of ["topHex", "bottomHex", "stemHex"]) {
      if (!HEX_REGEX.test(sw.colorway?.[key] ?? "")) {
        errors.push(`${label}: invalid colorway.${key} "${sw.colorway?.[key]}"`);
      }
    }
  });

  for (const reqId of REQUIRED_ORIGINAL_SWITCH_IDS) {
    if (!ids.has(reqId)) errors.push(`switches: missing required original id "${reqId}"`);
  }

  return errors;
}

function validateMice(mice) {
  const errors = [];
  const ids = new Set();
  const slugs = new Set();

  mice.forEach((ms, idx) => {
    const label = `mice[${idx}] (${ms.id ?? "unknown"})`;
    if (!ms.id || typeof ms.id !== "string") errors.push(`${label}: invalid id`);
    else if (ids.has(ms.id)) errors.push(`${label}: duplicate id`);
    else ids.add(ms.id);

    if (!ms.slug || !SLUG_REGEX.test(ms.slug)) errors.push(`${label}: invalid slug "${ms.slug}"`);
    else if (slugs.has(ms.slug)) errors.push(`${label}: duplicate slug "${ms.slug}"`);
    else slugs.add(ms.slug);

    if (!ms.name || !ms.nameEn || !ms.brand) errors.push(`${label}: missing name/nameEn/brand`);
    if (!VALID_POLLING_HZ.has(ms.maxPollingHz)) errors.push(`${label}: invalid maxPollingHz (${ms.maxPollingHz})`);
    if (!VALID_CONNECTIONS.has(ms.connection)) errors.push(`${label}: invalid connection "${ms.connection}"`);
    if (!VALID_SHAPES.has(ms.shape)) errors.push(`${label}: invalid shape "${ms.shape}"`);
    if (typeof ms.dimensionsMm?.length !== "number" || ms.dimensionsMm.length < 90 || ms.dimensionsMm.length > 150) {
      errors.push(`${label}: length out of range (${ms.dimensionsMm?.length})`);
    }
    if (typeof ms.dimensionsMm?.width !== "number" || ms.dimensionsMm.width < 45 || ms.dimensionsMm.width > 90) {
      errors.push(`${label}: width out of range (${ms.dimensionsMm?.width})`);
    }
    if (typeof ms.dimensionsMm?.height !== "number" || ms.dimensionsMm.height < 25 || ms.dimensionsMm.height > 60) {
      errors.push(`${label}: height out of range (${ms.dimensionsMm?.height})`);
    }
    if (typeof ms.weightGrams !== "number" || ms.weightGrams < 20 || ms.weightGrams > 150) {
      errors.push(`${label}: weightGrams out of range (${ms.weightGrams})`);
    }
    if (!ms.sensor) errors.push(`${label}: missing sensor`);
    if (!VALID_MOUSE_SWITCH_TYPES.has(ms.switchType)) errors.push(`${label}: invalid switchType "${ms.switchType}"`);
    if (!ms.switchModel) errors.push(`${label}: missing switchModel`);
    if (!HEX_REGEX.test(ms.colorAccentHex ?? "")) errors.push(`${label}: invalid colorAccentHex "${ms.colorAccentHex}"`);
  });

  for (const reqId of REQUIRED_ORIGINAL_MOUSE_IDS) {
    if (!ids.has(reqId)) errors.push(`mice: missing required original id "${reqId}"`);
  }

  return errors;
}

function generateSql(switches, mice) {
  const switchRows = switches
    .map(
      (sw) =>
        `  (${sqlStr(sw.id)}, ${sqlStr(sw.slug)}, ${sqlStr(sw.name)}, ${sqlStr(sw.nameEn)}, ${sqlStr(sw.brand)}, ${sqlStr(sw.category)}, ${sqlNum(sw.operatingForceGf)}, ${sqlNum(sw.bottomOutForceGf)}, ${sqlNum(sw.preTravelMm)}, ${sqlNum(sw.totalTravelMm)}, ${sqlNum(sw.springLengthMm)}, ${sqlStr(sw.springType)}, ${sqlStr(sw.materials.top)}, ${sqlStr(sw.materials.bottom)}, ${sqlStr(sw.materials.stem)}, ${sw.factoryLubed ? "true" : "false"}, ${sqlNum(sw.pins)}, ${sqlStr(sw.colorway.topHex)}, ${sqlStr(sw.colorway.bottomHex)}, ${sqlStr(sw.colorway.stemHex)})`
    )
    .join(",\n");

  const mouseRows = mice
    .map(
      (ms) =>
        `  (${sqlStr(ms.id)}, ${sqlStr(ms.slug)}, ${sqlStr(ms.name)}, ${sqlStr(ms.nameEn)}, ${sqlStr(ms.brand)}, ${sqlNum(ms.maxPollingHz)}, ${sqlStr(ms.connection)}, ${sqlStr(ms.shape)}, ${sqlNum(ms.dimensionsMm.length)}, ${sqlNum(ms.dimensionsMm.width)}, ${sqlNum(ms.dimensionsMm.height)}, ${sqlNum(ms.weightGrams)}, ${sqlStr(ms.sensor)}, ${sqlStr(ms.switchType)}, ${sqlStr(ms.switchModel)}, ${sqlStr(ms.colorAccentHex)})`
    )
    .join(",\n");

  return `-- ============================================================================
-- KEYNIVERSE 스펙 도감 마스터 데이터 (스위치 ${switches.length}종 · 마우스 ${mice.length}종)
-- scripts/sync-specs.mjs 자동 생성 파일 (중복 실행 안전 · upsert)
-- ============================================================================

insert into public.switches (
  id, slug, name, name_en, brand, category,
  operating_force_gf, bottom_out_force_gf, pre_travel_mm, total_travel_mm,
  spring_length_mm, spring_type,
  material_top, material_bottom, material_stem,
  factory_lubed, pins, color_top_hex, color_bottom_hex, color_stem_hex
) values
${switchRows}
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  brand = excluded.brand,
  category = excluded.category,
  operating_force_gf = excluded.operating_force_gf,
  bottom_out_force_gf = excluded.bottom_out_force_gf,
  pre_travel_mm = excluded.pre_travel_mm,
  total_travel_mm = excluded.total_travel_mm,
  spring_length_mm = excluded.spring_length_mm,
  spring_type = excluded.spring_type,
  material_top = excluded.material_top,
  material_bottom = excluded.material_bottom,
  material_stem = excluded.material_stem,
  factory_lubed = excluded.factory_lubed,
  pins = excluded.pins,
  color_top_hex = excluded.color_top_hex,
  color_bottom_hex = excluded.color_bottom_hex,
  color_stem_hex = excluded.color_stem_hex;

insert into public.mice (
  id, slug, name, name_en, brand, max_polling_hz, connection, shape,
  length_mm, width_mm, height_mm, weight_grams,
  sensor, switch_type, switch_model, color_accent_hex
) values
${mouseRows}
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  brand = excluded.brand,
  max_polling_hz = excluded.max_polling_hz,
  connection = excluded.connection,
  shape = excluded.shape,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  weight_grams = excluded.weight_grams,
  sensor = excluded.sensor,
  switch_type = excluded.switch_type,
  switch_model = excluded.switch_model,
  color_accent_hex = excluded.color_accent_hex;
`;
}

function generateTs(switches, mice, seedCommunity) {
  const defaultSwitchComm = {
    ratingAvg: 0,
    reviewCount: 0,
    pitchVotes: { low: 0, mid: 0, high: 0 },
    telemetryLogs: [],
  };
  const defaultMouseComm = {
    ratingAvg: 0,
    reviewCount: 0,
    gripVotes: { palm: 0, claw: 0, finger: 0 },
    handSizeVotes: { f1_f8: 0, f9: 0, f10: 0, f11_plus: 0 },
    telemetryLogs: [],
  };

  const fullSwitches = switches.map((sw) => ({
    ...sw,
    community: seedCommunity.switches?.[sw.id] ?? defaultSwitchComm,
  }));

  const fullMice = mice.map((ms) => ({
    ...ms,
    community: seedCommunity.mice?.[ms.id] ?? defaultMouseComm,
  }));

  return `// Auto-generated by scripts/sync-specs.mjs — do not edit manually.
import { MouseSpec, SwitchSpec } from "@/types/specs";

export const INITIAL_SWITCHES: SwitchSpec[] = ${JSON.stringify(fullSwitches, null, 2)};

export const INITIAL_MICE: MouseSpec[] = ${JSON.stringify(fullMice, null, 2)};
`;
}

function main() {
  const switches = readJson(SWITCHES_JSON_PATH);
  const mice = readJson(MICE_JSON_PATH);
  const seedCommunity = fs.existsSync(SEED_COMMUNITY_PATH)
    ? readJson(SEED_COMMUNITY_PATH)
    : { switches: {}, mice: {} };

  const errors = [...validateSwitches(switches), ...validateMice(mice)];
  if (errors.length > 0) {
    console.error(`[sync-specs] Validation FAILED (${errors.length} errors):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  fs.writeFileSync(OUT_SQL_PATH, generateSql(switches, mice), "utf8");
  fs.writeFileSync(OUT_TS_PATH, generateTs(switches, mice, seedCommunity), "utf8");

  const swForces = switches.map((s) => s.operatingForceGf);
  const swTravels = switches.map((s) => s.totalTravelMm);
  const msWeights = mice.map((m) => m.weightGrams);

  console.log(`[sync-specs] Validation PASSED!`);
  console.log(
    `  Switches: ${switches.length} (force ${Math.min(...swForces)}~${Math.max(...swForces)}gf, travel ${Math.min(...swTravels)}~${Math.max(...swTravels)}mm)`
  );
  console.log(
    `  Mice:     ${mice.length} (weight ${Math.min(...msWeights)}~${Math.max(...msWeights)}g)`
  );
  console.log(`  Wrote:    supabase/seed.sql & src/data/specs-data.ts`);
}

main();
