import { ApiError, authorizedFetch } from "./client";

export interface HourlyBucket {
  hour: number;
  total: number;
  answered: number;
}

export interface AgentMetrics {
  date: string;
  answeredCount: number;
  missedCount: number;
  busyCount: number;
  failedCount: number;
  totalCount: number;
  averageDurationSeconds: number;
  answerRate: number;
  byHour: HourlyBucket[];
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

export async function fetchAgentMetrics(
  token: string,
  date?: string,
): Promise<AgentMetrics> {
  const qs = date ? `?date=${date}` : "";
  const response = await authorizedFetch(token, `/v1/metrics/agent${qs}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as AgentMetrics;
}
