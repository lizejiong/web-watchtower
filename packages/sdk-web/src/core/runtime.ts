import type { EventType } from "../config"
import { createErrorPayload } from "../collectors/error"
import { createFailedRequestPayload } from "../collectors/network"
import { createEventEnvelope, type SdkEventEnvelope } from "../events/envelope"
import { MemoryQueue } from "../queue/memory-queue"
import { flushBatch, type FlushBatchResult } from "../transport/batch-transport"

/** runtime 使用的 fetch 实现，既可来自浏览器，也可由测试或宿主应用注入。 */
export type RuntimeFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

/** 创建监控 runtime 所需的最小运行时配置。 */
export type RuntimeConfig = {
  projectId: string
  appId: string
  sessionId: string
  url: string
  route?: string
  release?: string
  maxQueueSize: number
  fetcher: RuntimeFetcher
  endpoint?: string
  writeKey?: string
  targetWindow?: Window
}

/** SDK 初始化后返回的运行时控制面，负责采集、flush 和资源释放。 */
export type MonitoringRuntime = {
  /** 包装宿主 fetch，在请求失败时记录 request 事件并重新抛出原始错误。 */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  /** 手动采集错误对象或未知抛出值，事件只进入本地队列。 */
  captureError(error: unknown): void
  /** 将当前本地队列上报到 ingest，保留 retryable 事件用于后续重放。 */
  flush(): Promise<FlushBatchResult>
  /** 返回内存队列快照，仅用于调试和测试，不作为稳定业务 API。 */
  debugQueueItems(): SdkEventEnvelope[]
  /** 移除浏览器事件监听器，避免重复初始化或测试泄漏。 */
  dispose(): void
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

function createBatchId() {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `bat_${randomId}`
}

function createFlushBatch(events: readonly SdkEventEnvelope[]) {
  const batchId = createBatchId()

  return {
    batchId,
    sentAt: Date.now(),
    events: events.map((event) => ({
      ...event,
      batchId,
    })),
  }
}

function pushRuntimeEvent(
  queue: MemoryQueue<SdkEventEnvelope>,
  config: RuntimeConfig,
  type: EventType,
  url: string,
  payload: Record<string, unknown>,
) {
  queue.push(
    createEventEnvelope({
      projectId: config.projectId,
      appId: config.appId,
      sessionId: config.sessionId,
      type,
      url,
      route: config.route,
      release: config.release,
      payload,
    }),
  )
}

export function createMonitoringRuntime(config: RuntimeConfig): MonitoringRuntime {
  const queue = new MemoryQueue<SdkEventEnvelope>(config.maxQueueSize)
  const targetWindow = config.targetWindow ?? globalThis.window

  const captureError = (error: unknown) => {
    pushRuntimeEvent(queue, config, "error", config.url, createErrorPayload(error))
  }

  const onError = (event: ErrorEvent) => {
    event.preventDefault()
    captureError(event.error ?? event.message)
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault()
    captureError(event.reason)
  }

  targetWindow?.addEventListener("error", onError)
  targetWindow?.addEventListener("unhandledrejection", onUnhandledRejection)

  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      try {
        return await config.fetcher(input, init)
      } catch (error) {
        pushRuntimeEvent(
          queue,
          config,
          "request",
          requestUrl(input),
          createFailedRequestPayload(input, init, error),
        )
        throw error
      }
    },
    captureError,
    /** 将当前内存队列中的事件按批次上报，保留可重试失败事件用于后续重放。 */
    async flush() {
      const events = queue.items()

      if (events.length === 0) {
        return {
          retryableEventIds: [],
          droppedEventIds: [],
          acceptedEventIds: [],
          duplicatedEventIds: [],
        }
      }

      const result = await flushBatch(config.fetcher, createFlushBatch(events), {
        endpoint: config.endpoint,
        writeKey: config.writeKey,
      })
      queue.removeByIds([
        ...result.acceptedEventIds,
        ...result.duplicatedEventIds,
        ...result.droppedEventIds,
      ])

      return result
    },
    debugQueueItems: () => queue.items(),
    dispose: () => {
      targetWindow?.removeEventListener("error", onError)
      targetWindow?.removeEventListener("unhandledrejection", onUnhandledRejection)
    },
  }
}
