// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { createMonitoringRuntime } from "./runtime"

describe("createMonitoringRuntime", () => {
  it("captures failed fetch requests", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"))
    const runtime = createMonitoringRuntime({
      projectId: "proj_1",
      appId: "app_1",
      sessionId: "sess_1",
      url: "https://example.com/page",
      maxQueueSize: 100,
      fetcher,
    })

    await expect(runtime.fetch("https://example.com/api/orders")).rejects.toThrow(
      "offline",
    )
    expect(runtime.debugQueueItems()[0]).toMatchObject({
      type: "request",
      payload: {
        errorMessage: "offline",
        ok: false,
      },
    })

    runtime.dispose()
  })

  it("flushes queued events and keeps retryable rejected events for replay", async () => {
    const fetcher = vi.fn().mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        events: Array<{ id: string; payload: { message: string } }>
      }
      const accepted = body.events.find((event) => event.payload.message === "accepted")!
      const retry = body.events.find((event) => event.payload.message === "retry")!

      return {
        ok: true,
        json: async () => ({
          batchId: "bat_flush",
          accepted: [accepted.id],
          duplicated: [],
          rejected: [
            {
              eventId: retry.id,
              reason: "temporarily_unavailable",
              retryable: true,
            },
          ],
        }),
      }
    })
    const runtime = createMonitoringRuntime({
      projectId: "proj_1",
      appId: "app_1",
      sessionId: "sess_1",
      url: "https://example.com/page",
      maxQueueSize: 100,
      fetcher,
      endpoint: "https://ingest.example.com/api/v1/ingest/batches",
      writeKey: "wk_live",
    } as never)

    runtime.captureError(new Error("accepted"))
    runtime.captureError(new Error("retry"))
    const [, retryableEvent] = runtime.debugQueueItems()

    const result = await runtime.flush()

    expect(result.acceptedEventIds).toHaveLength(1)
    expect(runtime.debugQueueItems().map((event) => event.id)).toEqual([
      retryableEvent!.id,
    ])
    expect(fetcher).toHaveBeenCalledWith(
      "https://ingest.example.com/api/v1/ingest/batches",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-write-key": "wk_live",
        }),
      }),
    )
    const sentBatch = JSON.parse(String(fetcher.mock.calls[0]![1]!.body)) as {
      batchId: string
      events: Array<{ batchId: string }>
    }
    expect(sentBatch.events.map((event) => event.batchId)).toEqual([
      sentBatch.batchId,
      sentBatch.batchId,
    ])

    runtime.dispose()
  })
})
