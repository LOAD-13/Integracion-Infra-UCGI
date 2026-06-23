import { authorizedFetch, parseError } from "./client";

export type SkillStrategy =
  | "ALL_TO_FIRST"
  | "ROUND_ROBIN"
  | "LONGEST_IDLE"
  | "LEAST_BUSY";

export interface Skill {
  id: number;
  name: string;
  description: string | null;
  strategy: SkillStrategy;
  maxWaitSeconds: number;
  overflowSkillId: number | null;
  enabled: boolean;
  agentCount: number;
  agentIds: number[];
}

export interface SkillPayload {
  name: string;
  description: string | null;
  strategy: SkillStrategy;
  maxWaitSeconds: number;
  overflowSkillId: number | null;
  enabled?: boolean;
}

export async function listSkills(token: string): Promise<Skill[]> {
  const response = await authorizedFetch(token, "/v1/skills");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Skill[];
}

export async function listMySkills(token: string): Promise<Skill[]> {
  const response = await authorizedFetch(token, "/v1/skills/mine");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Skill[];
}

export async function createSkill(token: string, payload: SkillPayload): Promise<Skill> {
  const response = await authorizedFetch(token, "/v1/skills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Skill;
}

export async function updateSkill(
  token: string,
  id: number,
  payload: SkillPayload,
): Promise<Skill> {
  const response = await authorizedFetch(token, `/v1/skills/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Skill;
}

export async function deleteSkill(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/skills/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}

export async function assignAgentsToSkill(
  token: string,
  skillId: number,
  userIds: number[],
): Promise<Skill> {
  const response = await authorizedFetch(token, `/v1/skills/${skillId}/agents`, {
    method: "PUT",
    body: JSON.stringify({ userIds }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Skill;
}
