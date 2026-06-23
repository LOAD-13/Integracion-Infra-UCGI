import { authorizedFetch, parseError } from "./client";

export interface RecentActivity {
  kind: string;
  title: string;
  subtitle: string;
  meta: string;
  occurredAt: string;
}

export async function listRecentActivity(token: string): Promise<RecentActivity[]> {
  const r = await authorizedFetch(token, "/v1/me/recent-activity");
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as RecentActivity[];
}
