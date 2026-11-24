"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type InAppNotificationType = "comment" | "reply";

export interface InAppNotification {
  id: string;
  type: InAppNotificationType;
  actorNickname: string;
  postId: string;
  postTitle: string;
  commentPreview: string;
  isRead: boolean;
  createdAt: string;
}

const ENABLED_STORAGE_KEY_PREFIX = "keyniverse:notifications_enabled";

let notifications: InAppNotification[] = [];
let notificationsEnabled = true;
let synced = false;
let storeVersion = 1;
const listeners = new Set<() => void>();

function emit(): void {
  storeVersion += 1;
  listeners.forEach((fn) => fn());
}

function getEnabledStorageKey(userId: string): string {
  return `${ENABLED_STORAGE_KEY_PREFIX}:${userId}`;
}

function readCachedEnabled(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(getEnabledStorageKey(userId));
    if (raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

function writeCachedEnabled(userId: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getEnabledStorageKey(userId),
      enabled ? "true" : "false"
    );
  } catch {
    // storage quota / private mode
  }
}

export function clearSyncedNotifications(): void {
  if (notifications.length > 0 || synced || !notificationsEnabled) {
    notifications = [];
    notificationsEnabled = true;
    synced = false;
    emit();
  }
}

export function subscribeNotificationStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotificationStoreVersion(): number {
  return storeVersion;
}

export function getServerNotificationStoreVersion(): number {
  return 0;
}

export function readNotifications(): InAppNotification[] {
  return notifications;
}

export function readUnreadNotificationCount(): number {
  if (!notificationsEnabled) return 0;
  let count = 0;
  for (const n of notifications) {
    if (!n.isRead) count += 1;
  }
  return count;
}

export function readNotificationsEnabled(): boolean {
  return notificationsEnabled;
}

export function isNotificationsSynced(): boolean {
  return synced;
}

export async function syncNotificationsFromSupabase(
  userId: string | null
): Promise<void> {
  if (!userId) {
    if (notifications.length > 0 || synced) {
      notifications = [];
      notificationsEnabled = true;
      synced = false;
      emit();
    }
    return;
  }

  if (!synced) {
    notificationsEnabled = readCachedEnabled(userId);
  }

  if (!isSupabaseConfigured()) {
    synced = true;
    emit();
    return;
  }

  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  try {
    const [profileRes, notifRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("notifications_enabled")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select(
          "id, type, actor_nickname, post_id, post_title, comment_preview, is_read, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (
      !profileRes.error &&
      profileRes.data &&
      typeof profileRes.data.notifications_enabled === "boolean"
    ) {
      notificationsEnabled = profileRes.data.notifications_enabled;
      writeCachedEnabled(userId, notificationsEnabled);
    }

    if (!notifRes.error && Array.isArray(notifRes.data)) {
      notifications = (
        notifRes.data as Array<{
          id: unknown;
          type: unknown;
          actor_nickname: unknown;
          post_id: unknown;
          post_title: unknown;
          comment_preview: unknown;
          is_read: unknown;
          created_at: unknown;
        }>
      ).map((row) => ({
        id: String(row.id),
        type: row.type === "reply" ? "reply" : "comment",
        actorNickname: String(row.actor_nickname ?? "회원"),
        postId: String(row.post_id),
        postTitle: String(row.post_title ?? ""),
        commentPreview: String(row.comment_preview ?? ""),
        isRead: Boolean(row.is_read),
        createdAt: String(row.created_at ?? ""),
      }));
    }

    synced = true;
    emit();
  } catch {
    // 마이그레이션 적용 전 또는 일시적 네트워크 오류 시 무중단 유지
  }
}

export async function setNotificationsEnabled(
  userId: string | null | undefined,
  enabled: boolean
): Promise<boolean> {
  const prev = notificationsEnabled;
  notificationsEnabled = enabled;
  if (userId) {
    writeCachedEnabled(userId, enabled);
  }
  emit();

  if (!userId || !isSupabaseConfigured()) return true;

  const supabase = createSupabaseBrowserClient();
  if (!supabase) return true;

  const { error } = await supabase
    .from("profiles")
    .update({ notifications_enabled: enabled })
    .eq("id", userId);

  if (error) {
    notificationsEnabled = prev;
    writeCachedEnabled(userId, prev);
    emit();
    return false;
  }
  return true;
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const target = notifications.find((n) => n.id === notificationId);
  if (!target || target.isRead) return;

  notifications = notifications.map((n) =>
    n.id === notificationId ? { ...n, isRead: true } : n
  );
  emit();

  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function markAllNotificationsRead(
  userId: string | null | undefined
): Promise<void> {
  const hasUnread = notifications.some((n) => !n.isRead);
  if (!hasUnread) return;

  notifications = notifications.map((n) => ({ ...n, isRead: true }));
  emit();

  if (!userId || !isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

export async function deleteNotification(
  notificationId: string
): Promise<void> {
  notifications = notifications.filter((n) => n.id !== notificationId);
  emit();

  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("notifications").delete().eq("id", notificationId);
}

export function formatRelativeNotificationTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}
