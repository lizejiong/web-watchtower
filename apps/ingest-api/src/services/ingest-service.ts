import type {
  BatchIngestRequest,
  BatchIngestResponse,
  EventEnvelope,
} from "@web-monitoring/shared/events"

/** 事件持久化仓储接口。 */
export type IngestRepository = {
  insertEvent: (
    event: EventEnvelope,
  ) => Promise<{ status: "accepted" | "duplicated" }>
}

/** 执行批量事件入库并构造部分成功响应。 */
export async function ingestBatch(
  repository: IngestRepository,
  batch: BatchIngestRequest,
): Promise<BatchIngestResponse> {
  const accepted: string[] = []
  const duplicated: string[] = []
  const rejected: BatchIngestResponse["rejected"] = []

  for (const event of batch.events) {
    if (event.id === event.batchId || event.id.length === 0) {
      rejected.push({
        eventId: event.id,
        reason: "invalid_event_id",
        retryable: false,
      })
      continue
    }

    const result = await repository.insertEvent(event)

    if (result.status === "accepted") {
      accepted.push(event.id)
      continue
    }

    duplicated.push(event.id)
  }

  return {
    batchId: batch.batchId,
    accepted,
    duplicated,
    rejected,
  }
}
