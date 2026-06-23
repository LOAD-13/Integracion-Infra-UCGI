import { authorizedFetch, parseError } from "./client";

export interface ClientTag {
  id: number;
  name: string;
  colorBg: string;
  colorText: string;
  system: boolean;
}

export interface ClientTagPayload {
  name: string;
  colorBg: string;
  colorText: string;
}

export async function listClientTags(token: string): Promise<ClientTag[]> {
  const response = await authorizedFetch(token, "/v1/client-tags");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ClientTag[];
}

export async function createClientTag(
  token: string,
  payload: ClientTagPayload,
): Promise<ClientTag> {
  const response = await authorizedFetch(token, "/v1/client-tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ClientTag;
}

export async function updateClientTag(
  token: string,
  id: number,
  payload: ClientTagPayload,
): Promise<ClientTag> {
  const response = await authorizedFetch(token, `/v1/client-tags/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ClientTag;
}

export async function deleteClientTag(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/client-tags/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}
