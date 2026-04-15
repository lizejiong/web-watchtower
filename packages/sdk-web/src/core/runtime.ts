import type { EventType } from "../config"
import { createErrorPayload } from "../collectors/error"
import { createFailedRequestPayload } from "../collectors/network"
import { createEventEnvelope, type SdkEventEnvelope } from "../events/envelope"
import { MemoryQueue } from "../queue/memory-queue"

export type RuntimeFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type RuntimeConfig = {
  projectId: string
  appId: string
  sessionId: string
  url: string
  route?: string
  release?: string
  maxQueueSize: number
  fetcher: RuntimeFetcher
  targetWindow?: Window
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
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

export function createMonitoringRuntime(config: RuntimeConfig) {
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
    debugQueueItems: () => queue.items(),
    dispose: () => {
      targetWindow?.removeEventListener("error", onError)
      targetWindow?.removeEventListener("unhandledrejection", onUnhandledRejection)
    },
  }
}
