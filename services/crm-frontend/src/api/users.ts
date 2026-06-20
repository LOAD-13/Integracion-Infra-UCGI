import { ApiError, authorizedFetch } from "./client";

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "AGENTE";
  active: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "AGENTE";
  password: string;
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

export async function listUsers(token: string): Promise<UserSummary[]> {
  const response = await authorizedFetch(token, "/v1/users");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as UserSummary[];
}

export async function createUser(
  token: string,
  payload: CreateUserPayload,
): Promise<UserSummary> {
  const response = await authorizedFetch(token, "/v1/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as UserSummary;
}

export async function updateUserRole(
  token: string,
  id: number,
  role: "ADMIN" | "AGENTE",
): Promise<UserSummary> {
  const response = await authorizedFetch(token, `/v1/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as UserSummary;
}

export async function deleteUser(token: string, id: number): Promise<void> {
  const response = await authorizedFetch(token, `/v1/users/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) throw await parseError(response);
}
