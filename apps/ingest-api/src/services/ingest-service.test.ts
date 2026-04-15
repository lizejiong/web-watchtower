import { describe, expect, it, vi } from "vitest"

import { ingestBatch } from "./ingest-service"

describe("ingestBatch", () => {
  it("returns duplicated when the same eventId already exists", async () => {
    const repository = {
      insertEvent: vi
        .fn()
        .mockResolvedValueOnce({ status: "accepted" })
        .mockResolvedValueOnce({ status: "duplicated" }),
    }

    const response = await ingestBatch(repository as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [
        {
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
        },
        {
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
          payload: { message: "boom again" },
        },
      ],
    })

    expect(response.accepted).toEqual(["evt_1"])
    expect(response.duplicated).toEqual(["evt_1"])
  })

  it("rejects events with an invalid event id", async () => {
    const repository = {
      insertEvent: vi.fn(),
    }

    const response = await ingestBatch(repository as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [
        {
          id: "bat_1",
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
        },
      ],
    })

    expect(response.accepted).toEqual([])
    expect(response.duplicated).toEqual([])
    expect(response.rejected).toEqual([
      { eventId: "bat_1", reason: "invalid_event_id", retryable: false },
    ])
    expect(repository.insertEvent).not.toHaveBeenCalled()
  })
})
