import { afterEach, describe, expect, it, vi } from "vitest"
import type { MonitoringRuntime } from "@web-monitoring/sdk-web/index"

import {
  bootstrapMonitoring,
  captureRuntimeError,
  sendFailedRequest,
} from "./api"

let runtime: MonitoringRuntime | undefined

function createIngestResponse(init?: {
  rejected?: Array<{ eventId: string; reason: string; retryable: boolean }>
}) {
  return vi.fn().mockImplementation(async (input, requestInit) => {
    if (String(input).includes("/api/fail")) {
      throw new Error("offline")
    }

    const body = JSON.parse(String(requestInit?.body)) as {
      batchId: string
      events: Array<{ id: string }>
    }
    const rejectedIds = new Set(init?.rejected?.map((item) => item.eventId) ?? [])

    return {
      ok: true,
      json: async () => ({
        batchId: body.batchId,
        accepted: body.events
          .filter((event) => !rejectedIds.has(event.id))
          .map((event) => event.id),
        duplicated: [],
        rejected: init?.rejected ?? [],
      }),
    }
  })
}

function bootstrapWithFetcher(fetcher: ReturnType<typeof createIngestResponse>) {
  runtime = bootstrapMonitoring({
    projectId: "demo-project",
    appId: "playground-react",
    fetcher,
    transport: {
      endpoint: "/api/v1/ingest/batches",
      writeKey: "playground-write-key",
      batchSize: 10,
      flushIntervalMs: 5000,
      maxQueueSize: 100,
      sampleRate: 1,
    },
  } as never)
}

afterEach(() => {
  runtime?.dispose()
  runtime = undefined
  vi.restoreAllMocks()
})

describe("playground telemetry helpers", () => {
  it("flushes runtime errors through the SDK ingest transport", async () => {
    const fetcher = createIngestResponse()
    bootstrapWithFetcher(fetcher)

    await expect(captureRuntimeError()).resolves.toBe("success")

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/ingest/batches",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-write-key": "playground-write-key",
        }),
      }),
    )
    const requestBody = JSON.parse(String(fetcher.mock.calls[0]![1]!.body)) as {
      events: Array<{
        appId: string
        projectId: string
        type: string
        payload: { message?: string }
      }>
    }
    expect(requestBody.events[0]).toMatchObject({
      appId: "playground-react",
      projectId: "demo-project",
      type: "error",
      payload: { message: "playground runtime error" },
    })
  })

  it("flushes failed requests as request events", async () => {
    const fetcher = createIngestResponse()
    bootstrapWithFetcher(fetcher)

    await expect(sendFailedRequest()).resolves.toBe("success")

    const requestBody = JSON.parse(String(fetcher.mock.calls[1]![1]!.body)) as {
      events: Array<{ type: string; payload: { ok?: boolean; errorMessage?: string } }>
    }
    expect(requestBody.events[0]).toMatchObject({
      type: "request",
      payload: { ok: false, errorMessage: "offline" },
    })
  })
})
