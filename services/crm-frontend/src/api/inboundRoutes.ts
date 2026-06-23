import { authorizedFetch, parseError } from "./client";

export type ScheduleKind = "ALWAYS" | "BUSINESS" | "CUSTOM";
export type FallbackAction = "VOICEMAIL" | "OVERFLOW_SKILL" | "HANGUP";

export interface InboundRoute {
  id: number;
  didNumber: string;
  skillId: number;
  priority: number;
  scheduleKind: ScheduleKind;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  daysMask: number;
  fallbackAction: FallbackAction;
  fallbackSkillId: number | null;
  enabled: boolean;
}

export type InboundRoutePayload = Omit<InboundRoute, "id">;

export async function listInboundRoutes(token: string): Promise<InboundRoute[]> {
  const response = await authorizedFetch(token, "/v1/admin/inbound-routes");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as InboundRoute[];
}

export async function createInboundRoute(
  token: string,
  payload: InboundRoutePayload,
): Promise<InboundRoute> {
  const response = await authorizedFetch(token, "/v1/admin/inbound-routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as InboundRoute;
}

export async function updateInboundRoute(
  token: string,
  id: number,
  payload: InboundRoutePayload,
): Promise<InboundRoute> {
  const response = await authorizedFetch(token, `/v1/admin/inbound-routes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as InboundRoute;
}

export async function deleteInboundRoute(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/admin/inbound-routes/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}

export async function reorderInboundRoutes(
  token: string,
  orderedIds: number[],
): Promise<InboundRoute[]> {
  const response = await authorizedFetch(token, "/v1/admin/inbound-routes/reorder", {
    method: "PUT",
    body: JSON.stringify(orderedIds),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as InboundRoute[];
}
