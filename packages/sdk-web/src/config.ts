/** SDK 支持的遥测事件类型。 */
export type EventType =
  | "error"
  | "performance"
  | "request"
  | "behavior"
  | "breadcrumb"
  | "custom"

/** SDK 传输层配置。 */
export type SdkTransportConfig = {
  endpoint: string
  writeKey: string
  batchSize: number
  flushIntervalMs: number
  maxQueueSize: number
  sampleRate: number
}

/** SDK 初始化配置。 */
export type SdkConfig = {
  projectId: string
  appId: string
  transport: SdkTransportConfig
}
