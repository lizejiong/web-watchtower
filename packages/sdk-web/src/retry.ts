import type { BatchIngestResponse } from "@web-monitoring/shared/events"

/** 提取可重试 rejected 事件 id。 */
export function getRetryableRejectedEventIds(
  rejected: BatchIngestResponse["rejected"],
) {
  return rejected.filter((item) => item.retryable).map((item) => item.eventId)
}

/** 提取不可重试 rejected 事件 id。 */
export function getDroppedRejectedEventIds(
  rejected: BatchIngestResponse["rejected"],
) {
  return rejected.filter((item) => !item.retryable).map((item) => item.eventId)
}
