// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { initMonitoring } from "./init"

describe("initMonitoring", () => {
  it("captures window errors into the runtime queue", () => {
    const monitoring = initMonitoring({
      projectId: "proj_1",
      appId: "app_1",
      transport: {
        endpoint: "/api/v1/ingest/batches",
        writeKey: "wk_live",
        batchSize: 10,
        flushIntervalMs: 1000,
        maxQueueSize: 100,
        sampleRate: 1,
      },
    })

    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("boom"), message: "boom" }),
    )

    expect(monitoring.debugQueueItems()[0]).toMatchObject({
      type: "error",
      payload: { message: "boom" },
    })

    monitoring.dispose()
  })

  it("captures unhandled promise rejections into the runtime queue", () => {
    const monitoring = initMonitoring({
      projectId: "proj_1",
      appId: "app_1",
      transport: {
        endpoint: "/api/v1/ingest/batches",
        writeKey: "wk_live",
        batchSize: 10,
        flushIntervalMs: 1000,
        maxQueueSize: 100,
        sampleRate: 1,
      },
    })

    const event = new Event("unhandledrejection") as PromiseRejectionEvent
    Object.defineProperty(event, "reason", {
      value: new Error("async boom"),
    })

    window.dispatchEvent(event)

    expect(monitoring.debugQueueItems()[0]).toMatchObject({
      type: "error",
      payload: { message: "async boom" },
    })

    monitoring.dispose()
  })
})
