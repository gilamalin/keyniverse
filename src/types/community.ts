/**
 * Phase 2-B: 커뮤니티(/community) 데이터 스키마
 * 4대 말머리(build, diagnosis, vs, deal) 및 도감(specs-data.ts) 슬러그 연동 구조
 */

export type CommunityCategory =
  | "notice"
  | "build"
  | "diagnosis"
  | "vs"
  | "deal";

export type NoticeScope = "all" | "diagnosis" | "build" | "vs" | "deal";

export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  notice: "공지사항",
  build: "빌드/셋업",
  diagnosis: "자유 게시판",
  vs: "투표",
  deal: "특가/드랍",
};

export const COMMUNITY_CATEGORY_SHORT_LABELS: Record<
  CommunityCategory,
  string
> = {
  notice: "공지",
  build: "빌드",
  diagnosis: "자유",
  vs: "투표",
  deal: "특가",
};

export interface CommunityComment {
  id: string;
  author: string;
  authorVerified: boolean;
  content: string;
  createdAt: string;
  isMyComment?: boolean;
  /** 답글·대댓글일 때 묶이는 최상위(루트) 원댓글 ID (1단계 들여쓰기 그룹 기준) */
  parentId?: string;
  /** 대댓글(답글에 대한 답글) 작성 시 표시할 @멘션 대상 닉네임 */
  replyToAuthor?: string;
  /** 수정 여부 */
  isEdited?: boolean;
}

export interface BuildSetupMeta {
  boardName: string;
  plateMaterial: string;
  keycapProfile: string;
}

export interface DiagnosisSnapshotMeta {
  deviceType: "keyboard" | "mouse";
  metricLabel: string; // 예: "채터링 3회 (Min 8.4ms)" 또는 "Peak 7,960Hz · 더블클릭 0회"
  status: "warning" | "normal";
  verifiedProofAttached?: boolean;
}

export interface VsMatchupMeta {
  optionASlug: string;
  optionAName: string;
  optionAVotes: number;
  optionBSlug: string;
  optionBName: string;
  optionBVotes: number;
}

export interface DealInfoMeta {
  status: "active" | "ended";
  priceLabel: string; // 예: "280원/개" 또는 "99,000원"
  vendor: string;
  storeUrl?: string;
}

export interface CommunityImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface CommunityPost {
  id: string;
  category: CommunityCategory;
  /** 공지글(notice)일 때 어느 게시판 탭 상단에 고정 노출될지 지정 */
  noticeScope?: NoticeScope;
  title: string;
  content: string;
  /** 리치 텍스트 에디터로 작성된 서식/인라인 이미지 포함 HTML 본문 */
  contentHtml?: string;
  /** 첨부된 압축 이미지 목록 (최대 5장) */
  attachments?: CommunityImageAttachment[];
  author: string;
  /** Phase 1 테스터 통과 이력이 있는 유저 여부 ('⚡ 실측러' 배지 표시) */
  authorVerified: boolean;
  upvotes: number;
  views?: number;
  createdAt: string; // 예: "14:25", "11.16"
  sortTimestamp: number;
  /** 스펙 도감(specs-data.ts)과 연동되는 장비 슬러그 배열 */
  taggedDeviceSlugs: string[];
  buildMeta?: BuildSetupMeta;
  diagnosisMeta?: DiagnosisSnapshotMeta;
  vsMeta?: VsMatchupMeta;
  dealMeta?: DealInfoMeta;
  comments: CommunityComment[];
  isMyPost?: boolean;
  isEdited?: boolean;
}

export interface InFeedNativeSponsor {
  id: string;
  badgeLabel: string;
  title: string;
  specChip: string;
  ctaLabel: string;
  href: string;
}
