// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

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

  it("passes transport endpoint and write key into runtime flush", async () => {
    const fetcher = vi.fn().mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        batchId: string
        events: Array<{ id: string }>
      }

      return {
        ok: true,
        json: async () => ({
          batchId: body.batchId,
          accepted: body.events.map((event) => event.id),
          duplicated: [],
          rejected: [],
        }),
      }
    })

    const monitoring = initMonitoring({
      projectId: "proj_1",
      appId: "app_1",
      fetcher,
      transport: {
        endpoint: "https://ingest.example.com/api/v1/ingest/batches",
        writeKey: "wk_live",
        batchSize: 10,
        flushIntervalMs: 1000,
        maxQueueSize: 100,
        sampleRate: 1,
      },
    })

    monitoring.captureError(new Error("flush me"))
    await monitoring.flush()

    expect(fetcher).toHaveBeenCalledWith(
      "https://ingest.example.com/api/v1/ingest/batches",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-write-key": "wk_live",
        }),
      }),
    )
    expect(monitoring.debugQueueItems()).toEqual([])

    monitoring.dispose()
  })
})
