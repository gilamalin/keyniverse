import { Suspense } from "react";
import type { Metadata } from "next";
import { SpecsCatalog } from "@/components/specs/SpecsCatalog";
import { fetchCatalogSpecsFromSupabase } from "@/lib/specs-db";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  MOUSE_CONNECTION_LABELS,
  MOUSE_SHAPE_LABELS,
  SWITCH_CATEGORY_LABELS,
  formatSwitchPins,
} from "@/types/specs";

export const dynamic = "force-dynamic";

interface SpecsPageSearchParams {
  tab?: string | string[];
  open?: string | string[];
}

function getFirstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null;
  return null;
}

function findSpecBySlug(slug: string | null, tab: string | null) {
  if (!slug) return { switchSpec: null, mouseSpec: null };

  if (tab === "mice") {
    const mouseSpec = INITIAL_MICE.find((m) => m.slug === slug) ?? null;
    if (mouseSpec) return { switchSpec: null, mouseSpec };
  }

  const switchSpec = INITIAL_SWITCHES.find((s) => s.slug === slug) ?? null;
  if (switchSpec) return { switchSpec, mouseSpec: null };

  const mouseSpec = INITIAL_MICE.find((m) => m.slug === slug) ?? null;
  return { switchSpec: null, mouseSpec };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SpecsPageSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const tab = getFirstParam(params.tab);
  const openSlug = getFirstParam(params.open);
  const { switchSpec, mouseSpec } = findSpecBySlug(openSlug, tab);

  if (switchSpec) {
    const title = `${switchSpec.name} 스위치 스펙 | KEYNIVERSE`;
    const description = `${switchSpec.brand} ${SWITCH_CATEGORY_LABELS[switchSpec.category]} 스위치 · 입력압 ${switchSpec.operatingForceGf}gf · 총 스트로크 ${switchSpec.totalTravelMm}mm · ${switchSpec.materials.top}/${switchSpec.materials.bottom}/${switchSpec.materials.stem} · ${formatSwitchPins(switchSpec.pins)} · ${switchSpec.factoryLubed ? "공장 윤활" : "비윤활"}`;
    const canonicalPath = `/specs?tab=switches&open=${encodeURIComponent(switchSpec.slug)}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        type: "website",
        locale: "ko_KR",
        url: canonicalPath,
        siteName: "KEYNIVERSE",
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  }

  if (mouseSpec) {
    const title = `${mouseSpec.name} 마우스 스펙 | KEYNIVERSE`;
    const description = `${mouseSpec.brand} ${MOUSE_SHAPE_LABELS[mouseSpec.shape]} 게이밍 마우스 · ${mouseSpec.weightGrams}g · 최대 ${mouseSpec.maxPollingHz.toLocaleString()}Hz · ${mouseSpec.sensor} · ${MOUSE_CONNECTION_LABELS[mouseSpec.connection]} · ${mouseSpec.dimensionsMm.length}×${mouseSpec.dimensionsMm.width}×${mouseSpec.dimensionsMm.height}mm`;
    const canonicalPath = `/specs?tab=mice&open=${encodeURIComponent(mouseSpec.slug)}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        type: "website",
        locale: "ko_KR",
        url: canonicalPath,
        siteName: "KEYNIVERSE",
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  }

  return {
    title: "스위치 & 마우스 스펙 도감 | KEYNIVERSE",
    description:
      "공식 스펙 시트 기반의 키보드 스위치 120여 종 및 게이밍 마우스 80종 다중 조건 실시간 필터 도감",
    alternates: { canonical: "/specs" },
  };
}

export default async function SpecsPage({
  searchParams,
}: {
  searchParams: Promise<SpecsPageSearchParams>;
}) {
  const [params, { switches, mice }] = await Promise.all([
    searchParams,
    fetchCatalogSpecsFromSupabase(),
  ]);

  const tab = getFirstParam(params.tab);
  const openSlug = getFirstParam(params.open);
  const { switchSpec, mouseSpec } = findSpecBySlug(openSlug, tab);

  const jsonLd = switchSpec
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: switchSpec.name,
        alternateName: switchSpec.nameEn,
        brand: { "@type": "Brand", name: switchSpec.brand },
        category: `Mechanical Keyboard Switch (${SWITCH_CATEGORY_LABELS[switchSpec.category]})`,
        description: `${switchSpec.brand} ${SWITCH_CATEGORY_LABELS[switchSpec.category]} 스위치 · 입력압 ${switchSpec.operatingForceGf}gf · 총 스트로크 ${switchSpec.totalTravelMm}mm · ${formatSwitchPins(switchSpec.pins)}`,
        url: `https://keyniverse.vercel.app/specs?tab=switches&open=${encodeURIComponent(switchSpec.slug)}`,
      }
    : mouseSpec
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: mouseSpec.name,
          alternateName: mouseSpec.nameEn,
          brand: { "@type": "Brand", name: mouseSpec.brand },
          category: `Gaming Mouse (${MOUSE_SHAPE_LABELS[mouseSpec.shape]})`,
          description: `${mouseSpec.brand} 게이밍 마우스 · ${mouseSpec.weightGrams}g · ${mouseSpec.maxPollingHz.toLocaleString()}Hz · ${mouseSpec.sensor}`,
          url: `https://keyniverse.vercel.app/specs?tab=mice&open=${encodeURIComponent(mouseSpec.slug)}`,
        }
      : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Suspense
        fallback={
          <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-8 text-center font-mono text-xs text-[#8F9691]">
            스펙 도감 데이터를 불러오는 중...
          </div>
        }
      >
        <SpecsCatalog initialSwitches={switches} initialMice={mice} />
      </Suspense>
    </>
  );
}
