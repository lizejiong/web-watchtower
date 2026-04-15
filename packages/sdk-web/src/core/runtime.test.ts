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
})
