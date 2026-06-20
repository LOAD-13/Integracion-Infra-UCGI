import { ApiError, authorizedFetch } from "./client";

export interface Note {
  id: number;
  clientId: number;
  authorUserId: number | null;
  cdrId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
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

export async function listNotes(
  token: string,
  clientId: number,
): Promise<Note[]> {
  const response = await authorizedFetch(
    token,
    `/v1/notes?clientId=${clientId}`,
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Note[];
}

export async function createNote(
  token: string,
  payload: { clientId: number; cdrId?: number | null; body: string },
): Promise<Note> {
  const response = await authorizedFetch(token, "/v1/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Note;
}

export async function updateNote(
  token: string,
  id: number,
  body: string,
): Promise<Note> {
  const response = await authorizedFetch(token, `/v1/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as Note;
}
