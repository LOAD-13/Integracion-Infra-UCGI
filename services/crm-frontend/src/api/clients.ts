import { ApiError, authorizedFetch } from "./client";

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notesSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPayload {
  name: string;
  phone: string;
  email: string;
  company: string;
  notesSummary: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ListParams {
  q?: string;
  assignedToMe?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

function buildQuery(params: ListParams = {}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.assignedToMe) search.set("assignedToMe", "true");
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function parseError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // ignore
  }
  const message =
    (body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message)
      : null) ?? response.statusText;
  return new ApiError(response.status, message, body);
}

export async function listClients(
  token: string,
  params: ListParams = {},
): Promise<PageResponse<Client>> {
  const response = await authorizedFetch(
    token,
    `/v1/clients${buildQuery(params)}`,
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as PageResponse<Client>;
}

export async function getClient(token: string, id: number): Promise<Client> {
  const response = await authorizedFetch(token, `/v1/clients/${id}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Client;
}

export async function createClient(
  token: string,
  payload: ClientPayload,
): Promise<Client> {
  const response = await authorizedFetch(token, "/v1/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Client;
}

export async function updateClient(
  token: string,
  id: number,
  payload: ClientPayload,
): Promise<Client> {
  const response = await authorizedFetch(token, `/v1/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Client;
}

export async function deleteClient(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/clients/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}
