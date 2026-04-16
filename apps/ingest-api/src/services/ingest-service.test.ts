import { describe, expect, it, vi } from "vitest"

import { ingestBatch } from "./ingest-service"

function createEvent(eventId: string, type = "error") {
  return {
    id: eventId,
    batchId: "bat_1",
    type,
    schemaVersion: 1,
    timestamp: Date.now(),
    projectId: "proj_1",
    appId: "app_1",
    sessionId: "sess_1",
    url: "https://example.com/page",
    tags: {},
    context: {},
    payload: { message: "boom" },
  }
}

describe("ingestBatch", () => {
  it("publishes group_issue jobs for accepted error events", async () => {
    const repository = {
      insertEvent: vi.fn().mockResolvedValue({ status: "accepted" }),
    }
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    }

    const response = await ingestBatch(repository as never, publisher as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [createEvent("evt_1")],
    } as never)

    expect(response.accepted).toEqual(["evt_1"])
    expect(publisher.publish).toHaveBeenCalledWith({
      type: "group_issue",
      payload: { eventId: "evt_1" },
    })
  })

  it("does not publish jobs for duplicated or non-error events", async () => {
    const repository = {
      insertEvent: vi
        .fn()
        .mockResolvedValueOnce({ status: "duplicated" })
        .mockResolvedValueOnce({ status: "accepted" }),
    }
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    }

    const response = await ingestBatch(repository as never, publisher as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [createEvent("evt_1"), createEvent("evt_2", "resource")],
    } as never)

    expect(response.accepted).toEqual(["evt_2"])
    expect(response.duplicated).toEqual(["evt_1"])
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it("returns duplicated when the same eventId already exists", async () => {
    const repository = {
      insertEvent: vi
        .fn()
        .mockResolvedValueOnce({ status: "accepted" })
        .mockResolvedValueOnce({ status: "duplicated" }),
    }
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    }

    const response = await ingestBatch(repository as never, publisher as never, {
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
    expect(publisher.publish).toHaveBeenCalledTimes(1)
  })

  it("rejects events with an invalid event id", async () => {
    const repository = {
      insertEvent: vi.fn(),
    }
    const publisher = {
      publish: vi.fn(),
    }

    const response = await ingestBatch(repository as never, publisher as never, {
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
    expect(publisher.publish).not.toHaveBeenCalled()
  })
})
