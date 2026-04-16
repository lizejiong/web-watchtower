// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { initMonitoring } from "./init"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("initMonitoring without a browser window", () => {
  it("falls back to global fetch when no window object exists", async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetcher)

    const monitoring = initMonitoring({
      projectId: "proj_1",
      appId: "app_1",
      url: "https://example.com/page",
      transport: {
        endpoint: "/api/v1/ingest/batches",
        writeKey: "wk_live",
        batchSize: 10,
        flushIntervalMs: 1000,
        maxQueueSize: 100,
        sampleRate: 1,
      },
    })

    await monitoring.fetch("https://example.com/api/orders")

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api/orders",
      undefined,
    )
    monitoring.dispose()
  })
})
