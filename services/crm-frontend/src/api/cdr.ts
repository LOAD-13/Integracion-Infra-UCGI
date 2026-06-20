import { ApiError, authorizedFetch } from "./client";
import type { PageResponse } from "./clients";

export interface CdrEntry {
  id: number;
  callId: string;
  agentUserId: number | null;
  clientId: number | null;
  callerNumber: string;
  calleeNumber: string;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL" | null;
  startTime: string;
  answerTime: string | null;
  endTime: string | null;
  durationSeconds: number;
  disposition: "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED" | null;
}

export interface CdrListParams {
  clientId?: number;
  agentUserId?: number;
  from?: string;
  to?: string;
  disposition?: CdrEntry["disposition"];
  direction?: CdrEntry["direction"];
  page?: number;
  size?: number;
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

function buildQuery(params: CdrListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listCdr(
  token: string,
  params: CdrListParams,
): Promise<PageResponse<CdrEntry>> {
  const response = await authorizedFetch(token, `/v1/cdr${buildQuery(params)}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as PageResponse<CdrEntry>;
}
