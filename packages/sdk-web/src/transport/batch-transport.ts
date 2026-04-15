import type { BatchIngestRequest, BatchIngestResponse } from "@web-monitoring/shared/events"

import { getDroppedRejectedEventIds, getRetryableRejectedEventIds } from "../retry"

/** transport flush 结果。 */
export type FlushBatchResult = {
  retryableEventIds: string[]
  droppedEventIds: string[]
  acceptedEventIds: string[]
  duplicatedEventIds: string[]
}

/** 发送批量事件并解析部分成功响应。 */
export async function flushBatch(
  fetcher: (
    input: RequestInfo,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; json: () => Promise<BatchIngestResponse> }>,
  batch: BatchIngestRequest,
): Promise<FlushBatchResult> {
  const response = await fetcher("/api/v1/ingest/batches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(batch),
  })

  if (!response.ok) {
    return {
      retryableEventIds: batch.events.map((event) => event.id),
      droppedEventIds: [],
      acceptedEventIds: [],
      duplicatedEventIds: [],
    }
  }

  const parsed = await response.json()

  return {
    retryableEventIds: getRetryableRejectedEventIds(parsed.rejected),
    droppedEventIds: getDroppedRejectedEventIds(parsed.rejected),
    acceptedEventIds: parsed.accepted,
    duplicatedEventIds: parsed.duplicated,
  }
}
