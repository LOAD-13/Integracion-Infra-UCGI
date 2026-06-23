import { authorizedFetch, parseError } from "./client";

export type CampaignType = "MANUAL" | "PROGRESSIVE" | "PREDICTIVE";
export type CampaignStatus = "DRAFT" | "RUNNING" | "PAUSED" | "FINISHED";
export type CampaignContactStatus =
  | "PENDING"
  | "DIALING"
  | "ANSWERED"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "DONE";

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  ownerUserId: number | null;
  skillId: number | null;
  pacingFactor: number;
  maxConcurrent: number;
  callerId: string | null;
  totalContacts: number;
  pendingContacts: number;
  answeredContacts: number;
  createdAt: string;
}

export interface CampaignPayload {
  name: string;
  type: CampaignType;
  skillId: number | null;
  pacingFactor: number | null;
  maxConcurrent: number | null;
  callerId: string | null;
}

export interface CampaignContact {
  id: number;
  campaignId: number;
  clientId: number | null;
  phone: string;
  displayName: string | null;
  status: CampaignContactStatus;
  attempts: number;
  lastAttemptAt: string | null;
  position: number;
}

export interface CampaignContactPayload {
  clientId: number | null;
  phone: string;
  displayName: string | null;
  position: number | null;
}

export interface PredictiveSuggestion {
  dialNow: number;
  tmoSeconds: number;
}

export async function listMyCampaigns(token: string): Promise<Campaign[]> {
  const response = await authorizedFetch(token, "/v1/campaigns/mine");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign[];
}

export async function listAllCampaigns(token: string): Promise<Campaign[]> {
  const response = await authorizedFetch(token, "/v1/campaigns");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign[];
}

export async function getCampaign(token: string, id: number): Promise<Campaign> {
  const response = await authorizedFetch(token, `/v1/campaigns/${id}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign;
}

export async function createCampaign(
  token: string,
  payload: CampaignPayload,
): Promise<Campaign> {
  const response = await authorizedFetch(token, "/v1/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign;
}

export async function updateCampaign(
  token: string,
  id: number,
  payload: CampaignPayload,
): Promise<Campaign> {
  const response = await authorizedFetch(token, `/v1/campaigns/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign;
}

export async function deleteCampaign(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/campaigns/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}

export async function transitionCampaign(
  token: string,
  id: number,
  action: "start" | "pause" | "finish",
): Promise<Campaign> {
  const response = await authorizedFetch(token, `/v1/campaigns/${id}/${action}`, {
    method: "POST",
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Campaign;
}

export async function listCampaignContacts(
  token: string,
  campaignId: number,
): Promise<CampaignContact[]> {
  const response = await authorizedFetch(token, `/v1/campaigns/${campaignId}/contacts`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CampaignContact[];
}

export async function addCampaignContact(
  token: string,
  campaignId: number,
  payload: CampaignContactPayload,
): Promise<CampaignContact> {
  const response = await authorizedFetch(token, `/v1/campaigns/${campaignId}/contacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CampaignContact;
}

export async function nextCampaignContact(
  token: string,
  campaignId: number,
): Promise<CampaignContact | null> {
  const response = await authorizedFetch(token, `/v1/campaigns/${campaignId}/next`, {
    method: "POST",
  });
  if (response.status === 204) return null;
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CampaignContact;
}

export async function setContactStatus(
  token: string,
  contactId: number,
  status: CampaignContactStatus,
): Promise<CampaignContact> {
  const response = await authorizedFetch(
    token,
    `/v1/campaigns/contacts/${contactId}/status/${status}`,
    { method: "POST" },
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CampaignContact;
}

export async function getPredictiveSuggestion(
  token: string,
  campaignId: number,
): Promise<PredictiveSuggestion> {
  const response = await authorizedFetch(
    token,
    `/v1/campaigns/${campaignId}/predictive-suggestion`,
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as PredictiveSuggestion;
}
