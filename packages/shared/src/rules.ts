/** 支持的遥测事件类型列表。 */
export const EVENT_TYPES = [
  "error",
  "performance",
  "request",
  "behavior",
  "breadcrumb",
  "custom",
] as const

/** 批量上报相关的协议限制。 */
export const INGEST_LIMITS = {
  maxEventsPerBatch: 500,
} as const
