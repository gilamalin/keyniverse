import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AdminDashboardClient,
  AdminKpiStats,
  AdminReportItem,
  AdminUserItem,
} from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 | KEYNIVERSE",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // 관리자가 아니면 404 반환 (존재 여부 노출 차단)
  if (myProfile?.role !== "admin") {
    notFound();
  }

  const now = new Date();
  const nowMs = now.getTime();
  const todayStartIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();

  const [
    { data: profileRows },
    { data: postRows },
    { data: commentRows },
    { data: reportRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, email, role, points, banned_until, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("posts")
      .select("id, title, content, author_id, author_nickname, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("comments")
      .select("id, post_id, content, author_id, author_nickname, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("reports")
      .select("id, reporter_id, target_type, target_id, reason, detail, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const profiles = (profileRows ?? []) as Array<{
    id: string;
    nickname: string | null;
    email: string | null;
    role: string;
    points: number;
    banned_until: string | null;
    created_at: string;
  }>;

  const posts = (postRows ?? []) as Array<{
    id: string;
    title: string;
    content: string;
    author_id: string | null;
    author_nickname: string;
    created_at: string;
  }>;

  const comments = (commentRows ?? []) as Array<{
    id: string;
    post_id: string;
    content: string;
    author_id: string | null;
    author_nickname: string;
    created_at: string;
  }>;

  const rawReports = (reportRows ?? []) as Array<{
    id: string;
    reporter_id: string;
    target_type: "post" | "comment" | "reply";
    target_id: string;
    reason: string;
    detail: string | null;
    status: "pending" | "resolved" | "dismissed";
    created_at: string;
  }>;

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));

  const stats: AdminKpiStats = {
    totalUsers: profiles.length,
    todayUsers: profiles.filter((p) => p.created_at >= todayStartIso).length,
    totalPosts: posts.length,
    todayPosts: posts.filter((p) => p.created_at >= todayStartIso).length,
    pendingReports: rawReports.filter((r) => r.status === "pending").length,
    bannedUsers: profiles.filter(
      (p) => p.banned_until && new Date(p.banned_until).getTime() > nowMs
    ).length,
  };

  const initialUsers: AdminUserItem[] = profiles.map((p) => ({
    id: p.id,
    nickname: p.nickname ?? "(미설정)",
    email: p.email ?? "",
    role: p.role === "admin" ? "admin" : "user",
    points: p.points ?? 0,
    bannedUntil: p.banned_until,
    createdAt: p.created_at,
  }));

  const initialReports: AdminReportItem[] = rawReports.map((r) => {
    const reporter = profileMap.get(r.reporter_id);
    if (r.target_type === "post") {
      const targetPost = postMap.get(r.target_id);
      return {
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.created_at,
        reporterNickname: reporter?.nickname ?? "알 수 없음",
        targetAuthorId: targetPost?.author_id ?? null,
        targetAuthorNickname: targetPost?.author_nickname ?? "(삭제됨)",
        targetTitle: targetPost?.title ?? "(삭제된 게시글)",
        targetPreview: targetPost?.content?.slice(0, 160) ?? "",
        targetHref: targetPost ? `/?post=${encodeURIComponent(targetPost.id)}` : null,
        targetExists: Boolean(targetPost),
      };
    }

    const targetComment = commentMap.get(r.target_id);
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: r.created_at,
      reporterNickname: reporter?.nickname ?? "알 수 없음",
      targetAuthorId: targetComment?.author_id ?? null,
      targetAuthorNickname: targetComment?.author_nickname ?? "(삭제됨)",
      targetTitle: null,
      targetPreview: targetComment?.content?.slice(0, 160) ?? "(삭제된 댓글)",
      targetHref: targetComment
        ? `/?post=${encodeURIComponent(targetComment.post_id)}`
        : null,
      targetExists: Boolean(targetComment),
    };
  });

  return (
    <AdminDashboardClient
      currentAdminId={user.id}
      initialStats={stats}
      initialReports={initialReports}
      initialUsers={initialUsers}
    />
  );
}
