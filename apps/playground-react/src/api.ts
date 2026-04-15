import {
  initMonitoring,
  type FlushBatchResult,
  type MonitoringRuntime,
  type SdkConfig,
} from "@web-monitoring/sdk-web/index"

const playgroundConfig: SdkConfig = {
  projectId: "demo-project",
  appId: "playground-react",
  transport: {
    endpoint: "/api/v1/ingest/batches",
    writeKey: "playground-write-key",
    batchSize: 10,
    flushIntervalMs: 5000,
    maxQueueSize: 100,
    sampleRate: 1,
  },
}

type FlushSummary = {
  acceptedEventIds: string[]
  duplicatedEventIds: string[]
}

let monitoringRuntime: MonitoringRuntime | undefined

/** 启动 playground 使用的 SDK runtime，重复启动时会释放旧监听器。 */
export function bootstrapMonitoring(config: SdkConfig = playgroundConfig) {
  monitoringRuntime?.dispose()
  monitoringRuntime = initMonitoring(config)
  return monitoringRuntime
}

function getMonitoringRuntime() {
  return monitoringRuntime ?? bootstrapMonitoring()
}

export function formatFlushStatus(result: FlushSummary) {
  const total = result.acceptedEventIds.length + result.duplicatedEventIds.length
  return total > 0 ? "success" : "noop"
}

async function flushStatus(runtime: MonitoringRuntime) {
  const result: FlushBatchResult = await runtime.flush()
  return formatFlushStatus(result)
}

function createUnhandledRejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection") as PromiseRejectionEvent
  Object.defineProperty(event, "reason", { value: reason })
  return event
}

/** 采集一个运行时错误并立即 flush 到 ingest。 */
export async function captureRuntimeError() {
  const runtime = getMonitoringRuntime()
  runtime.captureError(new Error("playground runtime error"))
  return flushStatus(runtime)
}

/** 通过浏览器 unhandledrejection 事件采集 Promise 拒绝并 flush。 */
export async function capturePromiseRejection() {
  const runtime = getMonitoringRuntime()
  window.dispatchEvent(
    createUnhandledRejectionEvent(new Error("playground promise rejection")),
  )
  return flushStatus(runtime)
}

/** 发送一个会失败的请求，让 SDK fetch wrapper 采集 request 事件并 flush。 */
export async function sendFailedRequest() {
  const runtime = getMonitoringRuntime()

  try {
    await runtime.fetch("http://127.0.0.1:9/api/fail")
  } catch {}

  return flushStatus(runtime)
}

/** 模拟浏览器离线事件。 */
export function simulateOffline() {
  window.dispatchEvent(new Event("offline"))
  return formatFlushStatus({ acceptedEventIds: [], duplicatedEventIds: [] })
}
