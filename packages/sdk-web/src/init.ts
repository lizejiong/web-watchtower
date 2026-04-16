import type { SdkConfig } from "./config"
import { createMonitoringRuntime, type RuntimeFetcher } from "./core/runtime"

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function createDefaultFetcher(targetWindow: Window | undefined): RuntimeFetcher {
  if (targetWindow?.fetch) {
    return targetWindow.fetch.bind(targetWindow)
  }

  if (globalThis.fetch) {
    return globalThis.fetch.bind(globalThis)
  }

  throw new Error("No fetch implementation available. Provide config.fetcher.")
}

export function initMonitoring(config: SdkConfig) {
  const targetWindow = globalThis.window
  const fetcher = config.fetcher ?? createDefaultFetcher(targetWindow)

  return createMonitoringRuntime({
    projectId: config.projectId,
    appId: config.appId,
    sessionId: config.sessionId ?? createSessionId(),
    url: config.url ?? targetWindow?.location.href ?? "about:blank",
    route: config.route,
    release: config.release,
    maxQueueSize: config.transport.maxQueueSize,
    fetcher,
    endpoint: config.transport.endpoint,
    writeKey: config.transport.writeKey,
    targetWindow,
  })
}
