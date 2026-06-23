import { authorizedFetch, parseError } from "./client";

export type NotificationKind =
  | "MISSED_CALL"
  | "NOTE_ASSIGNED"
  | "NEW_CLIENT"
  | "METRICS_UPDATED"
  | "SYSTEM";

export interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export async function listNotifications(
  token: string,
  unreadOnly = false,
): Promise<Notification[]> {
  const response = await authorizedFetch(
    token,
    `/v1/notifications${unreadOnly ? "?unread=true" : ""}`,
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Notification[];
}

export async function getUnreadCount(token: string): Promise<number> {
  const response = await authorizedFetch(token, "/v1/notifications/unread-count");
  if (!response.ok) throw await parseError(response);
  const json = (await response.json()) as { count: number };
  return json.count;
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const response = await authorizedFetch(token, "/v1/notifications/mark-all-read", {
    method: "POST",
  });
  if (!response.ok) throw await parseError(response);
  const json = (await response.json()) as { updated: number };
  return json.updated;
}
