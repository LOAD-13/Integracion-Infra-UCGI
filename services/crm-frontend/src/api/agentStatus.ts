import { authorizedFetch, parseError } from "./client";

export type AgentStatus = "AVAILABLE" | "BREAK" | "BUSY" | "DND" | "OFFLINE";

export interface AgentStatusInfo {
  status: AgentStatus;
  since: string;
}

export async function getAgentStatus(token: string): Promise<AgentStatusInfo> {
  const response = await authorizedFetch(token, "/v1/me/status");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as AgentStatusInfo;
}

export async function setAgentStatus(
  token: string,
  status: AgentStatus,
): Promise<AgentStatusInfo> {
  const response = await authorizedFetch(token, "/v1/me/status", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as AgentStatusInfo;
}
