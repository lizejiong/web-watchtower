import type { BatchIngestRequest, BatchIngestResponse } from "./events"

/** ingest 批量上报接口路径。 */
export const INGEST_BATCH_PATH = "/api/v1/ingest/batches"

/** SDK 写入 key 的请求头名称。 */
export const WRITE_KEY_HEADER = "x-write-key"

/** 批量上报请求协议类型。 */
export type { BatchIngestRequest }

/** 批量上报响应协议类型。 */
export type { BatchIngestResponse }
