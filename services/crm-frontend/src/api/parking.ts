import { authorizedFetch, parseError } from "./client";

export interface ParkingConfig {
  loopSeconds: number;
  timeoutSeconds: number;
  greetingUrl: string | null;
  holdMusicUrl: string | null;
  volumePct: number;
  enabled: boolean;
}

export type ParkingAction = "CALLBACK" | "KEEP_WAITING" | "HANGUP" | "TRANSFER_SKILL";

export interface ParkingIvrOption {
  id: number;
  dtmfKey: string;
  label: string;
  action: ParkingAction;
  transferSkillId: number | null;
  position: number;
}

export type ParkingIvrOptionPayload = Omit<ParkingIvrOption, "id">;

export async function getParkingConfig(token: string): Promise<ParkingConfig> {
  const response = await authorizedFetch(token, "/v1/admin/parking");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ParkingConfig;
}

export async function updateParkingConfig(
  token: string,
  payload: ParkingConfig,
): Promise<ParkingConfig> {
  const response = await authorizedFetch(token, "/v1/admin/parking", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ParkingConfig;
}

export async function listIvrOptions(token: string): Promise<ParkingIvrOption[]> {
  const response = await authorizedFetch(token, "/v1/admin/parking/options");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ParkingIvrOption[];
}

export async function createIvrOption(
  token: string,
  payload: ParkingIvrOptionPayload,
): Promise<ParkingIvrOption> {
  const response = await authorizedFetch(token, "/v1/admin/parking/options", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ParkingIvrOption;
}

export async function updateIvrOption(
  token: string,
  id: number,
  payload: ParkingIvrOptionPayload,
): Promise<ParkingIvrOption> {
  const response = await authorizedFetch(token, `/v1/admin/parking/options/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ParkingIvrOption;
}

export async function deleteIvrOption(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/admin/parking/options/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}
