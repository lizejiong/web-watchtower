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

/** 启动 playground 使用的最小 SDK 配置。 */
export function bootstrapMonitoring() {
  return initMonitoring(playgroundConfig)
}

/** 触发一个同步运行时错误。 */
export function throwRuntimeError(): never {
  throw new Error("playground runtime error")
}

/** 触发一个未处理的 Promise 拒绝。 */
export function triggerPromiseRejection() {
  void Promise.reject(new Error("playground rejection"))
}

/** 发送一个会失败的网络请求。 */
export async function sendFailedRequest() {
  try {
    await fetch("http://127.0.0.1:9/api/fail")
  } catch {
    return
  }
}

/** 模拟浏览器离线事件。 */
export function simulateOffline() {
  window.dispatchEvent(new Event("offline"))
}
