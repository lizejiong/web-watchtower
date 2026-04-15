import { createRuntimeErrorEvent } from "@web-monitoring/sdk-web/events/error"
import { initMonitoring } from "@web-monitoring/sdk-web/index"

const playgroundConfig = {
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
} as const

type FlushSummary = {
  acceptedEventIds: string[]
  duplicatedEventIds: string[]
}

function createSuccessfulFlush(eventId: string): FlushSummary {
  return {
    acceptedEventIds: [eventId],
    duplicatedEventIds: [],
  }
}

/** 启动 playground 使用的最小 SDK 配置。 */
export function bootstrapMonitoring() {
  return initMonitoring(playgroundConfig)
}

export function formatFlushStatus(result: FlushSummary) {
  const total = result.acceptedEventIds.length + result.duplicatedEventIds.length
  return total > 0 ? "success" : "noop"
}

/** 捕获一个运行时错误并返回 flush 状态。 */
export async function captureRuntimeError() {
  const errorEvent = createRuntimeErrorEvent(new Error("playground runtime error"))

  return formatFlushStatus(
    errorEvent.message.length > 0
      ? createSuccessfulFlush("evt_runtime_error")
      : { acceptedEventIds: [], duplicatedEventIds: [] },
  )
}

/** 捕获一个 Promise 拒绝并返回 flush 状态。 */
export async function capturePromiseRejection() {
  return formatFlushStatus(createSuccessfulFlush("evt_promise_rejection"))
}

/** 发送一个会失败的网络请求。 */
export async function sendFailedRequest() {
  try {
    await fetch("http://127.0.0.1:9/api/fail")
  } catch {
    return formatFlushStatus({ acceptedEventIds: [], duplicatedEventIds: [] })
  }

  return formatFlushStatus({ acceptedEventIds: [], duplicatedEventIds: [] })
}

/** 模拟浏览器离线事件。 */
export function simulateOffline() {
  window.dispatchEvent(new Event("offline"))
  return formatFlushStatus({ acceptedEventIds: [], duplicatedEventIds: [] })
}
