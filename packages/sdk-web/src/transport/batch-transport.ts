import type { BatchIngestRequest, BatchIngestResponse } from "@web-monitoring/shared/events"
import { INGEST_BATCH_PATH, WRITE_KEY_HEADER } from "@web-monitoring/shared/protocol"

import { getDroppedRejectedEventIds, getRetryableRejectedEventIds } from "../retry"

/** SDK 批量上报 transport 的调用配置。 */
export type FlushBatchOptions = {
  endpoint?: string
  writeKey?: string
}

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
  options: FlushBatchOptions = {},
): Promise<FlushBatchResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }

  if (options.writeKey) {
    headers[WRITE_KEY_HEADER] = options.writeKey
  }

  const response = await fetcher(options.endpoint ?? INGEST_BATCH_PATH, {
    method: "POST",
    headers,
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
