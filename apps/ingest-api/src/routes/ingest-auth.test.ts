import { describe, expect, it } from "vitest"

import { buildApp } from "../app"

describe("ingest auth", () => {
  it("rejects missing write key", async () => {
    const app = buildApp()
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ingest/batches",
      payload: { batchId: "bat_1", sentAt: Date.now(), events: [] },
    })

    expect(response.statusCode).toBe(401)
  })
})
