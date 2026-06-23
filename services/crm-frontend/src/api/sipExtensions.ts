import { authorizedFetch, parseError } from "./client";

export interface SipExtension {
  id: number;
  userId: number;
  username: string;
  extensionNumber: string;
  enabled: boolean;
  manualAttributesApplied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SipExtensionCreatePayload {
  username: string;
  extensionNumber: string;
  password: string;
  displayName?: string;
}

export interface SipExtensionUpdatePayload {
  password?: string;
  enabled?: boolean;
}

export async function listSipExtensions(token: string): Promise<SipExtension[]> {
  const response = await authorizedFetch(token, "/v1/sip-extensions");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as SipExtension[];
}

export async function createSipExtension(
  token: string,
  payload: SipExtensionCreatePayload,
): Promise<SipExtension> {
  const response = await authorizedFetch(token, "/v1/sip-extensions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as SipExtension;
}

export async function updateSipExtension(
  token: string,
  id: number,
  payload: SipExtensionUpdatePayload,
): Promise<SipExtension> {
  const response = await authorizedFetch(token, `/v1/sip-extensions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as SipExtension;
}

export async function deleteSipExtension(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/sip-extensions/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}
