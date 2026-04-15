import { describe, expect, it, vi } from "vitest"

import { buildApp } from "../app"

function createEvent(eventId: string, message = `boom-${eventId}`) {
  return {
    id: eventId,
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
    payload: { message },
  }
}

describe("ingest batch route", () => {
  it("returns accepted, duplicated, and rejected events together", async () => {
    const repository = {
      insertEvent: vi
        .fn()
        .mockResolvedValueOnce({ status: "accepted" })
        .mockResolvedValueOnce({ status: "duplicated" }),
    }

    const app = buildApp({
      ingestRepository: repository,
    })

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ingest/batches",
      headers: {
        "x-write-key": "wk_test",
      },
      payload: {
        batchId: "bat_1",
        sentAt: Date.now(),
        events: [
          createEvent("evt_1", "playground runtime error"),
          createEvent("evt_2"),
          createEvent("bat_1"),
        ],
      },
    })

    expect(response.statusCode).toBe(202)
    expect(repository.insertEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: expect.objectContaining({
          message: "playground runtime error",
        }),
      }),
    )
    expect(response.json()).toEqual({
      batchId: "bat_1",
      accepted: ["evt_1"],
      duplicated: ["evt_2"],
      rejected: [{ eventId: "bat_1", reason: "invalid_event_id", retryable: false }],
    })
  })
})
