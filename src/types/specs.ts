/**
 * Phase 2-A: 스위치 & 마우스 스펙 도감 TypeScript Schema
 * 향후 Supabase 테이블(switches, mice, spec_telemetry_logs, spec_verified_votes)과 1:1 매핑되도록 설계
 */

export type SpecTabType = "switches" | "mice";

export type SwitchCategory =
  | "linear"
  | "tactile"
  | "silent_linear"
  | "silent_tactile"
  | "clicky"
  | "electro_capacitive"
  | "magnetic";

export const SWITCH_CATEGORY_LABELS: Record<SwitchCategory, string> = {
  linear: "리니어",
  tactile: "택타일",
  silent_linear: "저소음 리니어",
  silent_tactile: "저소음 택타일",
  clicky: "클릭",
  electro_capacitive: "무접점",
  magnetic: "자석축",
};

export type SpringType = "1단" | "2단" | "3단" | null;

export type SwitchPinCount = 0 | 2 | 3 | 5;

export function formatSwitchPins(pins: SwitchPinCount): string {
  return pins === 0 ? "무핀" : `${pins}핀`;
}

export interface SwitchMaterials {
  top: string;
  bottom: string;
  stem: string;
}

export interface SwitchColorway {
  topHex: string;
  bottomHex: string;
  stemHex: string;
}

export type SwitchPitchChoice = "low" | "mid" | "high";

export const SWITCH_PITCH_LABELS: Record<SwitchPitchChoice, string> = {
  low: "로우피치",
  mid: "미들피치",
  high: "하이피치",
};

export type MouseGripChoice = "palm" | "claw" | "finger";

export const MOUSE_GRIP_LABELS: Record<MouseGripChoice, string> = {
  palm: "팜 그립",
  claw: "클로 그립",
  finger: "핑거 그립",
};

export type MouseHandSizeChoice = "f1_f8" | "f9" | "f10" | "f11_plus";

export const MOUSE_HAND_SIZE_LABELS: Record<MouseHandSizeChoice, string> = {
  f1_f8: "F1~F8",
  f9: "F9",
  f10: "F10",
  f11_plus: "F11+",
};

export type TelemetryBadgeTone = "sand" | "sage";

/**
 * 자유 서술형 코멘트를 배제하고, 무결점 실측 인증 배지와 정형 선택값만 기록하는 검증 로그
 */
export interface VerifiedTelemetryLog {
  id: string;
  createdAt: string;
  rating: number;
  structuredSummary: string;
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
  isCurrentUser?: boolean;
}

export interface SwitchCommunityData {
  ratingAvg: number;
  reviewCount: number;
  pitchVotes: {
    low: number;
    mid: number;
    high: number;
  };
  telemetryLogs: VerifiedTelemetryLog[];
}

export interface SwitchSpec {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  brand: string;
  category: SwitchCategory;
  /** 입력압 (gf) - 공식 스펙 시트 필수 수치 (연속 슬라이더 필터 기준) */
  operatingForceGf: number;
  /** 바닥압 (gf) - 제조사 미공개 시 null */
  bottomOutForceGf: number | null;
  /** 입력 지점 Pre-travel (mm) */
  preTravelMm: number;
  /** 총 스트로크 Total travel (mm) */
  totalTravelMm: number;
  /** 스프링 길이 (mm) - 미공개 시 null */
  springLengthMm: number | null;
  /** 스프링 구분 (1단 / 2단 / null) */
  springType: SpringType;
  /** 하우징 및 스템 소재 (공식 스펙 원문 표기) */
  materials: SwitchMaterials;
  /** 공장 윤활 여부 */
  factoryLubed: boolean;
  /** 핀 방식 (무핀 / 2핀 / 3핀 / 5핀) */
  pins: SwitchPinCount;
  /** 외부 이미지 대신 스위치 단면 그래픽을 표현하기 위한 컬러 조합 */
  colorway: SwitchColorway;
  /** 정형화된 체감 투표 및 실측 인증 로그 데이터 */
  community: SwitchCommunityData;
}

export type MousePollingHz = 1000 | 2000 | 4000 | 8000;

export type MouseConnection = "wireless_wired" | "wired";

export const MOUSE_CONNECTION_LABELS: Record<MouseConnection, string> = {
  wireless_wired: "유무선",
  wired: "유선",
};

export type MouseShape = "symmetrical" | "ergonomic";

export const MOUSE_SHAPE_LABELS: Record<MouseShape, string> = {
  symmetrical: "대칭형",
  ergonomic: "비대칭형",
};

export type MouseSwitchType = "optical" | "mechanical";

export const MOUSE_SWITCH_TYPE_LABELS: Record<MouseSwitchType, string> = {
  optical: "광학식",
  mechanical: "기계식",
};

export interface MouseDimensionsMm {
  /** 세로 길이 L (mm) */
  length: number;
  /** 가로 폭 W (mm) */
  width: number;
  /** 등 높이 H (mm) */
  height: number;
}

export interface MouseCommunityData {
  ratingAvg: number;
  reviewCount: number;
  gripVotes: {
    palm: number;
    claw: number;
    finger: number;
  };
  handSizeVotes: {
    f1_f8: number;
    f9: number;
    f10: number;
    f11_plus: number;
  };
  telemetryLogs: VerifiedTelemetryLog[];
}

export interface MouseSpec {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  brand: string;
  /** 최대 지원 폴링레이트 (Hz) */
  maxPollingHz: MousePollingHz;
  /** 연결 방식 */
  connection: MouseConnection;
  /** 쉘 형태 (대칭형 / 비대칭형) */
  shape: MouseShape;
  /** 공식 외형 치수 (L × W × H mm) */
  dimensionsMm: MouseDimensionsMm;
  /** 공식 무게 (g, 케이블 제외 순수 무게) */
  weightGrams: number;
  /** 탑재 센서 명칭 */
  sensor: string;
  /** 메인 클릭 스위치 방식 (광학식 / 기계식) */
  switchType: MouseSwitchType;
  /** 메인 클릭 스위치 세부 모델명 */
  switchModel: string;
  /** 마우스 실루엣 다이어그램용 포인트 색상 */
  colorAccentHex: string;
  /** 정형화된 체감 투표(손 크기, 그립법) 및 실측 인증 로그 데이터 */
  community: MouseCommunityData;
}
