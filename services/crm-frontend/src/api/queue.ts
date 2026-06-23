import { authorizedFetch, parseError } from "./client";

export interface QueueEntry {
  uniqueId: string;
  fromNumber: string;
  clientName: string | null;
  reason: string;
  waitTime: string;
  priority: "alta" | "media" | "baja";
}

export async function listIncomingQueue(token: string): Promise<QueueEntry[]> {
  const response = await authorizedFetch(token, "/v1/queues/incoming");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as QueueEntry[];
}
