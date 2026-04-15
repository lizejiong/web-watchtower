import { describe, expect, it } from "vitest"

import { batchIngestResponseSchema, eventEnvelopeSchema } from "./events"

describe("eventEnvelopeSchema", () => {
  it("accepts a valid error event", () => {
    const parsed = eventEnvelopeSchema.parse({
      id: "evt_1",
      batchId: "bat_1",
      type: "error",
      schemaVersion: 1,
      timestamp: Date.now(),
      projectId: "proj_1",
      appId: "app_1",
      sessionId: "sess_1",
      url: "https://example.com/page",
      tags: {},
      context: {},
      payload: { message: "boom" },
    })

    expect(parsed.id).toBe("evt_1")
  })

  it("rejects unknown top-level event types", () => {
    expect(() =>
      eventEnvelopeSchema.parse({
        id: "evt_2",
        batchId: "bat_1",
        type: "made-up",
        schemaVersion: 1,
        timestamp: Date.now(),
        projectId: "proj_1",
        appId: "app_1",
        sessionId: "sess_1",
        url: "https://example.com/page",
        tags: {},
        context: {},
        payload: {},
      }),
    ).toThrow()
  })
})

describe("batchIngestResponseSchema", () => {
  it("accepts partial success responses", () => {
    const parsed = batchIngestResponseSchema.parse({
      batchId: "bat_1",
      accepted: ["evt_1"],
      duplicated: ["evt_2"],
      rejected: [{ eventId: "evt_3", reason: "payload_too_large", retryable: false }],
    })

    expect(parsed.rejected[0]?.retryable).toBe(false)
  })
})
