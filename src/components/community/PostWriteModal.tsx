"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  Check,
  ImagePlus,
  Italic,
  List,
  Minus,
  PenSquare,
  Search,
  Strikethrough,
  Swords,
  Trash2,
  Underline,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  COMMUNITY_CATEGORY_LABELS,
  CommunityCategory,
  CommunityImageAttachment,
  CommunityPost,
} from "@/types/community";
import {
  GoogleUserSession,
  isSessionAdmin,
  isSessionBanned,
} from "@/lib/auth-store";
import {
  POST_HTML_MAX_LENGTH,
  POST_MAX_LINES,
  POST_TITLE_MAX_LENGTH,
  countPostLines,
  createEntityId,
  measurePostHtmlLength,
  sanitizePostContent,
  sanitizePostHtmlContent,
  sanitizePostTitle,
} from "@/lib/community-store";
import { uploadCommunityImage } from "@/lib/community-storage";
import { cn } from "@/lib/utils";

interface LatestSnapshotInfo {
  deviceType: "keyboard" | "mouse";
  deviceSlug: string;
  deviceName: string;
  metricLabel: string;
}

interface PostWriteModalProps {
  open: boolean;
  session: GoogleUserSession | null;
  isVerifiedTester: boolean;
  latestSnapshot: LatestSnapshotInfo | null;
  editingPost?: CommunityPost | null;
  onCreatePost: (post: CommunityPost) => void;
  onUpdatePost?: (postId: string, updated: Partial<CommunityPost>) => void;
  onClose: () => void;
}

const MAX_IMAGE_COUNT = 5;
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function formatNowClock(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getCurrentTimestampMs(): number {
  return new Date().getTime();
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

/**
 * 업로드된 이미지를 브라우저 Canvas를 이용해 최대 가로 1200px WebP로 자동 압축 (서버·스토리지 부하 방지)
 */
async function compressImageFile(file: File): Promise<CommunityImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("손상된 이미지 파일입니다."));
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 1200;
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        if (targetW > maxWidth || targetH > maxHeight) {
          const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("브라우저 이미지 압축 컨텍스트를 초기화할 수 없습니다."));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL("image/webp", 0.82);
        const approxBytes = Math.round((dataUrl.length * 3) / 4);

        resolve({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          dataUrl,
          sizeBytes: approxBytes,
          width: targetW,
          height: targetH,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function PostWriteModal({
  open,
  session,
  isVerifiedTester,
  editingPost = null,
  onCreatePost,
  onUpdatePost,
  onClose,
}: PostWriteModalProps) {
  const isEditMode = Boolean(editingPost);

  const [category, setCategory] = useState<CommunityCategory>(
    editingPost?.category &&
      (editingPost.category !== "notice" || isSessionAdmin(session))
      ? editingPost.category
      : "diagnosis"
  );
  const [title, setTitle] = useState<string>(editingPost?.title ?? "");
  const [editorEmpty, setEditorEmpty] = useState<boolean>(
    !editingPost?.content && !(editingPost?.attachments?.length ?? 0)
  );
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<CommunityImageAttachment[]>(
    editingPost?.attachments ?? []
  );

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 공통 도감 장비 검색 및 다중 태그 선택기 상태 (build / diagnosis / deal)
  const [deviceSearch, setDeviceSearch] = useState<string>("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    editingPost && editingPost.category !== "vs"
      ? editingPost.taggedDeviceSlugs
      : []
  );

  // 0) [공지사항] 전용 노출 게시판 범위 (관리자 전용)
  const [noticeScope, setNoticeScope] = useState<
    "all" | "diagnosis" | "build" | "vs" | "deal"
  >(editingPost?.noticeScope ?? "all");

  // 1) [빌드/셋업] 전용 필드
  const [boardName, setBoardName] = useState<string>(
    editingPost?.buildMeta?.boardName ?? ""
  );
  const [plateMaterial, setPlateMaterial] = useState<string>(
    editingPost?.buildMeta?.plateMaterial ?? ""
  );
  const [keycapProfile, setKeycapProfile] = useState<string>(
    editingPost?.buildMeta?.keycapProfile ?? ""
  );

  // 3) [투표] 전용 필드
  const [vsSlugA, setVsSlugA] = useState<string>(
    editingPost?.vsMeta?.optionASlug ?? INITIAL_MICE[0].slug
  );
  const [vsSlugB, setVsSlugB] = useState<string>(
    editingPost?.vsMeta?.optionBSlug ?? INITIAL_MICE[1].slug
  );

  // 4) [특가/드랍] 전용 필드
  const [dealPriceRaw, setDealPriceRaw] = useState<string>(() => {
    if (editingPost?.dealMeta?.priceLabel) {
      const digits = editingPost.dealMeta.priceLabel.replace(/\D/g, "");
      return digits || "280";
    }
    return "280";
  });
  const [dealUnitMode, setDealUnitMode] = useState<"per_switch" | "total">(
    editingPost?.dealMeta?.priceLabel?.includes("/개")
      ? "per_switch"
      : editingPost?.dealMeta
        ? "total"
        : "per_switch"
  );
  const [dealVendor, setDealVendor] = useState<string>(
    editingPost?.dealMeta?.vendor ?? ""
  );
  const [dealStoreUrl, setDealStoreUrl] = useState<string>(
    editingPost?.dealMeta?.storeUrl ?? ""
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initializedPostIdRef = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !editingPost) return;
    if (initializedPostIdRef.current === editingPost.id) return;
    initializedPostIdRef.current = editingPost.id;
    if (editingPost.contentHtml) {
      el.innerHTML = editingPost.contentHtml;
    } else if (editingPost.content) {
      el.innerText = editingPost.content;
    }
  }, [editingPost]);

  const allSpecDevices = useMemo(
    () => [
      ...INITIAL_SWITCHES.map((sw) => ({
        slug: sw.slug,
        name: sw.name,
        brand: sw.brand,
        kindLabel: "SW",
      })),
      ...INITIAL_MICE.map((ms) => ({
        slug: ms.slug,
        name: ms.name,
        brand: ms.brand,
        kindLabel: "MS",
      })),
    ],
    []
  );

  const filteredDeviceOptions = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return allSpecDevices;
    return allSpecDevices.filter((d) =>
      `${d.name} ${d.brand} ${d.kindLabel}`.toLowerCase().includes(q)
    );
  }, [allSpecDevices, deviceSearch]);

  if (!open || !session) return null;

  const syncEditorEmptyState = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = (el.innerText || "").trim();
    const hasImg = el.querySelector("img") !== null;
    setEditorEmpty(text.length === 0 && !hasImg);
  };

  const applyFormatCommand = (command: string, value?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    syncEditorEmptyState();
  };

  const insertImageIntoEditor = (att: CommunityImageAttachment) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const imgHtml = `<img src="${att.dataUrl}" alt="${att.name.replace(/"/g, "")}" data-attachment-id="${att.id}" /><div><br></div>`;
    document.execCommand("insertHTML", false, imgHtml);
    syncEditorEmptyState();
  };

  const handleFilesUpload = async (fileList: FileList | File[]) => {
    setErrorMsg(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_IMAGE_COUNT) {
      setErrorMsg(
        `이미지는 게시글당 최대 ${MAX_IMAGE_COUNT}장까지만 첨부할 수 있습니다.`
      );
      return;
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setErrorMsg(
          "지원하지 않는 파일 형식입니다. JPG, PNG, WebP, GIF 이미지 파일만 첨부 가능합니다."
        );
        return;
      }
      if (file.size > MAX_SINGLE_FILE_BYTES) {
        setErrorMsg(
          `[${file.name}] 파일 용량이 5MB를 초과합니다. 장당 최대 5MB 이하의 이미지만 업로드할 수 있습니다.`
        );
        return;
      }
    }

    try {
      const compressedList: CommunityImageAttachment[] = [];
      for (const file of files) {
        const compressed = await compressImageFile(file);
        const uploadedUrl = await uploadCommunityImage(
          compressed.dataUrl,
          session?.userId
        );
        compressedList.push({
          ...compressed,
          dataUrl: uploadedUrl,
        });
      }

      setAttachments((prev) => [...prev, ...compressedList]);
      for (const item of compressedList) {
        insertImageIntoEditor(item);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "이미지 처리 중 오류가 발생했습니다."
      );
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attId));
    const el = editorRef.current;
    if (el) {
      const targetImgs = el.querySelectorAll(
        `img[data-attachment-id="${attId}"]`
      );
      targetImgs.forEach((node) => node.remove());
      syncEditorEmptyState();
    }
  };

  const toggleTagSlug = (slug: string) => {
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((item) => item !== slug);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), slug];
      }
      return [...prev, slug];
    });
  };

  const formattedDealPrice = (() => {
    const digits = dealPriceRaw.replace(/\D/g, "");
    const num = digits ? Number.parseInt(digits, 10) : 0;
    const formatted = `${num.toLocaleString()}원`;
    return dealUnitMode === "per_switch" ? `${formatted}/개` : formatted;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sanitizedTitle = sanitizePostTitle(title);
    const rawText = (editorRef.current?.innerText ?? "").trim();
    const rawHtml = (editorRef.current?.innerHTML ?? "").trim();

    if (!sanitizedTitle) {
      setErrorMsg("게시글 제목을 입력해 주세요.");
      return;
    }
    if (isSessionBanned(session)) {
      setErrorMsg("현재 활동 정지 상태에서는 게시글을 작성할 수 없습니다.");
      return;
    }

    if (!rawText && attachments.length === 0) {
      setErrorMsg("게시글 본문 내용을 입력하거나 이미지를 첨부해 주세요.");
      return;
    }
    const measuredHtmlLen = measurePostHtmlLength(rawHtml);
    const measuredLines = countPostLines(rawText);

    if (measuredHtmlLen > POST_HTML_MAX_LENGTH) {
      setErrorMsg(
        `게시글 본문은 HTML 기준 최대 ${POST_HTML_MAX_LENGTH.toLocaleString()}자까지 작성할 수 있습니다. (현재 ${measuredHtmlLen.toLocaleString()}자)`
      );
      return;
    }
    if (measuredLines > POST_MAX_LINES) {
      setErrorMsg(
        `게시글 본문 줄 수는 최대 ${POST_MAX_LINES}줄까지 허용됩니다. (현재 ${measuredLines}줄)`
      );
      return;
    }

    if (category === "vs" && vsSlugA === vsSlugB) {
      setErrorMsg("투표의 장비 A와 장비 B는 서로 다른 제품으로 선택해 주세요.");
      return;
    }

    const optionADev = allSpecDevices.find((d) => d.slug === vsSlugA);
    const optionBDev = allSpecDevices.find((d) => d.slug === vsSlugB);

    const sanitizedText = sanitizePostContent(rawText) || "(이미지 게시글)";
    const sanitizedHtml = rawHtml
      ? sanitizePostHtmlContent(rawHtml)
      : undefined;

    if (isEditMode && editingPost && onUpdatePost) {
      onUpdatePost(editingPost.id, {
        category,
        noticeScope: category === "notice" ? noticeScope : undefined,
        title: sanitizedTitle,
        content: sanitizedText,
        contentHtml: sanitizedHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
        taggedDeviceSlugs:
          category === "vs"
            ? [vsSlugA, vsSlugB]
            : category === "build"
              ? selectedSlugs
              : [],
        buildMeta:
          category === "build"
            ? {
                boardName: boardName.trim() || "Custom Mechanical Board",
                plateMaterial: plateMaterial.trim() || "알루미늄 보강판",
                keycapProfile: keycapProfile.trim() || "Cherry PBT",
              }
            : undefined,
        vsMeta:
          category === "vs" && optionADev && optionBDev
            ? {
                optionASlug: optionADev.slug,
                optionAName: optionADev.name,
                optionAVotes: editingPost.vsMeta?.optionAVotes ?? 0,
                optionBSlug: optionBDev.slug,
                optionBName: optionBDev.name,
                optionBVotes: editingPost.vsMeta?.optionBVotes ?? 0,
              }
            : undefined,
        dealMeta:
          category === "deal"
            ? {
                status: editingPost.dealMeta?.status ?? "active",
                priceLabel: formattedDealPrice,
                vendor: dealVendor.trim() || "국내 파트너 스토어",
                storeUrl: dealStoreUrl.trim() || undefined,
              }
            : undefined,
        isEdited: true,
      });
      return;
    }

    const nowMs = getCurrentTimestampMs();

    const newPost: CommunityPost = {
      id: createEntityId("post"),
      category,
      noticeScope: category === "notice" ? noticeScope : undefined,
      title: sanitizedTitle,
      content: sanitizedText,
      contentHtml: sanitizedHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
      author: session.nickname,
      authorVerified: isVerifiedTester,
      authorIsAdmin: isSessionAdmin(session),
      upvotes: 0,
      views: 1,
      createdAt: formatNowClock(),
      sortTimestamp: nowMs,
      taggedDeviceSlugs:
        category === "vs" ? [vsSlugA, vsSlugB] : selectedSlugs,
      buildMeta:
        category === "build"
          ? {
              boardName: boardName.trim() || "Custom Mechanical Board",
              plateMaterial: plateMaterial.trim() || "알루미늄 보강판",
              keycapProfile: keycapProfile.trim() || "Cherry PBT",
            }
          : undefined,
      vsMeta:
        category === "vs" && optionADev && optionBDev
          ? {
              optionASlug: optionADev.slug,
              optionAName: optionADev.name,
              optionAVotes: 0,
              optionBSlug: optionBDev.slug,
              optionBName: optionBDev.name,
              optionBVotes: 0,
            }
          : undefined,
      dealMeta:
        category === "deal"
          ? {
              status: "active",
              priceLabel: formattedDealPrice,
              vendor: dealVendor.trim() || "국내 파트너 스토어",
              storeUrl: dealStoreUrl.trim() || undefined,
            }
          : undefined,
      comments: [],
      isMyPost: true,
    };

    onCreatePost(newPost);
  };

  return (
    <article
      aria-label={isEditMode ? "게시글 수정" : "게시글 작성"}
      className="flex w-full flex-col overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
    >
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#282D2A] bg-[#151816] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <PenSquare className="size-4 text-[#6B9080]" />
          <h2 className="text-base font-bold text-[#E4E6E1]">
            {isEditMode ? "게시글 수정" : "게시글 작성"}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
        >
          <ArrowLeft className="size-3.5" />
          <span>{isEditMode ? "상세로 돌아가기" : "목록으로"}</span>
        </button>
      </div>

      {/* 본문 작성 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {/* 게시판(말머리) 선택 탭 */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            게시판
          </span>
          <div
            className={cn(
              "grid grid-cols-2 gap-1.5",
              isSessionAdmin(session) ? "sm:grid-cols-5" : "sm:grid-cols-4"
            )}
          >
            {(
              (isSessionAdmin(session)
                ? ["notice", "diagnosis", "build", "vs", "deal"]
                : ["diagnosis", "build", "vs", "deal"]) as CommunityCategory[]
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-lg border py-2 text-xs font-semibold transition-colors",
                  category === cat
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                [{COMMUNITY_CATEGORY_LABELS[cat]}]
              </button>
            ))}
          </div>
          {isSessionAdmin(session) && category === "notice" && (
            <div className="mt-3 rounded-lg border border-[#282D2A] bg-[#151816] p-3">
              <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
                공지 고정 게시판
              </span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {(
                  [
                    { id: "all", label: "전체" },
                    { id: "diagnosis", label: "자유 게시판" },
                    { id: "build", label: "빌드/셋업" },
                    { id: "vs", label: "투표" },
                    { id: "deal", label: "특가/드랍" },
                  ] as const
                ).map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setNoticeScope(scope.id)}
                    className={cn(
                      "rounded-md border py-1.5 text-xs font-semibold transition-colors",
                      noticeScope === scope.id
                        ? "border-[#6B9080] bg-[#222623] text-[#6B9080]"
                        : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:text-[#E4E6E1]"
                    )}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isSessionBanned(session) && (
            <p className="mt-2 rounded-lg border border-[#E06C75]/50 bg-[#151816] px-3 py-2 text-xs text-[#E06C75]">
              현재 활동 정지 상태에서는 게시글을 작성할 수 없습니다.
            </p>
          )}
        </div>

        {/* 게시글 제목 (최대 80자 제한 + 연속 공백 자동 압축) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-[#E4E6E1]">
              제목
            </label>
            <span className="font-mono text-[11px] text-[#8F9691] tabular-nums">
              {title.length}/{POST_TITLE_MAX_LENGTH}자
            </span>
          </div>
          <input
            type="text"
            maxLength={POST_TITLE_MAX_LENGTH}
            value={title}
            onChange={(e) =>
              setTitle(e.target.value.slice(0, POST_TITLE_MAX_LENGTH))
            }
            placeholder="제목을 입력하세요..."
            className="h-10 w-full rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 text-sm text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
          />
        </div>

        {/* 본문 내용 (서식 툴바 + 이미지 첨부 + min-h-[380px] / max-h-[600px] 스크롤 에디터) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-[#E4E6E1]">
              본문
            </label>
            <span className="font-mono text-[11px] text-[#8F9691] tabular-nums">
              이미지 {attachments.length}/{MAX_IMAGE_COUNT}장
            </span>
          </div>

          <div
            className={cn(
              "overflow-hidden rounded-xl border bg-[#151816] transition-colors",
              isDragOver ? "border-[#6B9080]" : "border-[#282D2A]"
            )}
          >
            {/* 에디터 상단 서식 툴바 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#282D2A] bg-[#1A1D1B] px-3 py-2">
              <div className="flex flex-wrap items-center gap-1">
                {/* 글자 크기 선택 */}
                <select
                  aria-label="글자 크기"
                  defaultValue="3"
                  onChange={(e) =>
                    applyFormatCommand("fontSize", e.target.value)
                  }
                  className="mr-1 h-7 rounded border border-[#282D2A] bg-[#151816] px-2 text-xs text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                >
                  <option value="2">작게</option>
                  <option value="3">기본 크기</option>
                  <option value="4">크게</option>
                  <option value="5">제목 크기</option>
                </select>

                {/* 굵게 / 기울임 / 밑줄 / 취소선 */}
                <button
                  type="button"
                  onClick={() => applyFormatCommand("bold")}
                  title="굵게 (Ctrl+B)"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <Bold className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatCommand("italic")}
                  title="기울임 (Ctrl+I)"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <Italic className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatCommand("underline")}
                  title="밑줄 (Ctrl+U)"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <Underline className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatCommand("strikeThrough")}
                  title="취소선"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <Strikethrough className="size-3.5" />
                </button>

                <div className="mx-1 h-4 w-px bg-[#282D2A]" />

                {/* 테마 포인트 색상 4종 (기본 / 세이지 그린 / 우드 샌드 / 코랄) */}
                {(
                  [
                    { hex: "#E4E6E1", label: "기본 텍스트 색상" },
                    { hex: "#6B9080", label: "세이지 그린 강조" },
                    { hex: "#D4A373", label: "우드 샌드 강조" },
                    { hex: "#E06C75", label: "코랄 레드 강조" },
                  ] as const
                ).map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => applyFormatCommand("foreColor", col.hex)}
                    title={col.label}
                    className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] hover:border-[#6B9080]"
                  >
                    <span
                      className="size-3.5 rounded-full border border-black/40"
                      style={{ backgroundColor: col.hex }}
                    />
                  </button>
                ))}

                <div className="mx-1 h-4 w-px bg-[#282D2A]" />

                {/* 글머리 기호 리스트 & 구분선 */}
                <button
                  type="button"
                  onClick={() => applyFormatCommand("insertUnorderedList")}
                  title="글머리 기호 목록"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <List className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatCommand("insertHorizontalRule")}
                  title="구분선 삽입"
                  className="flex size-7 items-center justify-center rounded border border-[#282D2A] bg-[#151816] text-[#E4E6E1] hover:border-[#6B9080] hover:bg-[#222623]"
                >
                  <Minus className="size-3.5" />
                </button>
              </div>

              {/* 우측: 이미지 첨부 버튼 */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      void handleFilesUpload(e.target.files);
                      e.target.value = "";
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-[#6B9080]/60 bg-[#222623] px-2.5 text-xs font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:bg-[#6B9080] hover:text-[#121413]"
                >
                  <ImagePlus className="size-3.5 text-[#6B9080] group-hover:text-[#121413]" />
                  <span>이미지</span>
                </button>
              </div>
            </div>

            {/* 리치 텍스트 본문 편집 영역 (min-h-[380px] ~ max-h-[600px] 내부 스크롤바 동작) */}
            <div className="relative">
              {editorEmpty && (
                <div className="pointer-events-none absolute top-4 left-4 text-xs leading-relaxed text-[#8F9691]">
                  내용을 입력하세요 (이미지 드래그 · Ctrl+V 가능)
                </div>
              )}

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncEditorEmptyState}
                onBlur={syncEditorEmptyState}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void handleFilesUpload(e.dataTransfer.files);
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const imageFiles: File[] = [];
                  for (let i = 0; i < items.length; i += 1) {
                    const item = items[i];
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    void handleFilesUpload(imageFiles);
                  }
                }}
                className="min-h-[220px] max-h-[600px] w-full overflow-y-auto p-4 text-sm leading-relaxed text-[#E4E6E1] focus:outline-none sm:min-h-[340px] [&_hr]:my-3 [&_hr]:border-[#282D2A] [&_img]:my-2.5 [&_img]:max-h-[420px] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-[#282D2A] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              />
            </div>

            {/* 첨부된 이미지 썸네일 & 압축 용량 확인 바 */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#282D2A] bg-[#1A1D1B] px-3.5 py-2.5">
                <span className="font-mono text-[11px] font-semibold text-[#8F9691] tabular-nums">
                  첨부됨 ({attachments.length}/{MAX_IMAGE_COUNT}):
                </span>
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#282D2A] bg-[#151816] px-2.5 py-1 text-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="size-6 rounded object-cover"
                    />
                    <span className="max-w-[120px] truncate text-[#E4E6E1]">
                      {att.name}
                    </span>
                    <span className="font-mono text-[10px] text-[#6B9080] tabular-nums">
                      {formatByteSize(att.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="첨부 이미지 삭제"
                      className="text-[#8F9691] transition-colors hover:text-[#E06C75]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. [투표] 본문 하단: 도감 장비 매치업 생성기 */}
        {category === "vs" && (
          <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5">
            <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#D4A373]">
              <Swords className="size-3.5" />
              투표 후보
            </span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-[11px] font-semibold text-[#6B9080]">
                  OPTION A
                </label>
                <select
                  value={vsSlugA}
                  onChange={(e) => setVsSlugA(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                >
                  {allSpecDevices.map((dev) => (
                    <option key={dev.slug} value={dev.slug}>
                      [{dev.kindLabel}] {dev.name} ({dev.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] font-semibold text-[#D4A373]">
                  OPTION B
                </label>
                <select
                  value={vsSlugB}
                  onChange={(e) => setVsSlugB(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] focus:border-[#D4A373] focus:outline-none"
                >
                  {allSpecDevices.map((dev) => (
                    <option key={dev.slug} value={dev.slug}>
                      [{dev.kindLabel}] {dev.name} ({dev.brand})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 5. 도감 장비 태그 선택기 ([빌드/셋업] 전용) */}
        {category === "build" && (
          <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#E4E6E1]">
                장비 태그 (최대 3개)
              </span>
              <div className="relative w-44">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-[#8F9691]" />
                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder="장비 검색..."
                  className="h-7 w-full rounded border border-[#282D2A] bg-[#1A1D1B] pr-2 pl-6 text-[11px] text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {filteredDeviceOptions.map((dev) => {
                const active = selectedSlugs.includes(dev.slug);
                return (
                  <button
                    key={dev.slug}
                    type="button"
                    onClick={() => toggleTagSlug(dev.slug)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                        : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:text-[#E4E6E1]"
                    )}
                  >
                    {active && <Check className="size-3 text-[#6B9080]" />}
                    <span className="font-mono text-[10px] text-[#8F9691]">
                      {dev.kindLabel}
                    </span>
                    <span>{dev.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. 빌드/셋업 및 특가/드랍 부가 정보 입력 */}
        {category === "build" && (
          <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5">
            <span className="mb-2 block text-xs font-semibold text-[#6B9080]">
              빌드 구성
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                type="text"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder="하우징 (예: Neo80)"
                className="h-8 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
              />
              <input
                type="text"
                value={plateMaterial}
                onChange={(e) => setPlateMaterial(e.target.value)}
                placeholder="보강판 (예: 알루미늄 / FR4)"
                className="h-8 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
              />
              <input
                type="text"
                value={keycapProfile}
                onChange={(e) => setKeycapProfile(e.target.value)}
                placeholder="키캡 (예: GMK Botanical)"
                className="h-8 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
              />
            </div>
          </div>
        )}

        {category === "deal" && (
          <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5">
            <span className="mb-2.5 block text-xs font-semibold text-[#D4A373]">
              특가 정보
            </span>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={dealPriceRaw}
                  onChange={(e) =>
                    setDealPriceRaw(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="단가 숫자 (예: 280)"
                  className="h-8 w-full rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 font-mono text-xs text-[#E4E6E1] tabular-nums focus:border-[#6B9080] focus:outline-none"
                />
                <select
                  aria-label="단가 기준"
                  value={dealUnitMode}
                  onChange={(e) =>
                    setDealUnitMode(
                      e.target.value as "per_switch" | "total"
                    )
                  }
                  className="h-8 shrink-0 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2 text-xs text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                >
                  <option value="per_switch">원/개</option>
                  <option value="total">원</option>
                </select>
              </div>

              <input
                type="text"
                value={dealVendor}
                onChange={(e) => setDealVendor(e.target.value)}
                placeholder="판매처 (예: 스웨그키 / 스마트스토어)"
                className="h-8 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
              />

              <input
                type="url"
                value={dealStoreUrl}
                onChange={(e) => setDealStoreUrl(e.target.value)}
                placeholder="스토어 URL (https://...)"
                className="h-8 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 font-mono text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
              />
            </div>

            <p className="mt-1.5 font-mono text-[11px] text-[#8F9691] tabular-nums">
              표기 미리보기:{" "}
              <strong className="text-[#D4A373]">
                진행중 · {formattedDealPrice}
              </strong>
            </p>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs font-medium text-[#E06C75]">{errorMsg}</p>
        )}

        {/* 하단 제출 버튼 */}
        <div className="flex items-center justify-end gap-2 border-t border-[#282D2A] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#282D2A] bg-[#151816] px-4 py-2 text-xs font-semibold text-[#8F9691] hover:text-[#E4E6E1]"
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-lg border border-[#6B9080] bg-[#6B9080] px-5 py-2 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291]"
          >
            {isEditMode ? "수정 완료" : "등록"}
          </button>
        </div>
      </form>
    </article>
  );
}
