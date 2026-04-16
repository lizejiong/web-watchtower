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
      jobPublisher: {
        publish: vi.fn().mockResolvedValue(undefined),
      },
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

  it("returns 429 when the batch would exceed the hourly quota", async () => {
    const keyService = {
      validateWriteKey: vi.fn().mockResolvedValue({
        projectId: "proj_1",
        appId: "app_1",
        hourlyQuota: 1,
        dailyQuota: 10,
        allowedOrigins: ["https://example.com"],
      }),
    }
    const rateLimitService = {
      checkIngestRateLimit: vi.fn().mockResolvedValue({
        allowed: false,
        reason: "hourly_quota_exceeded",
      }),
    }
    const app = buildApp({
      keyService,
      rateLimitService,
    })

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ingest/batches",
      headers: {
        "x-write-key": "wk_live",
        origin: "https://example.com",
      },
      payload: {
        batchId: "bat_1",
        sentAt: Date.now(),
        events: [createEvent("evt_1")],
      },
    })

    expect(response.statusCode).toBe(429)
    expect(keyService.validateWriteKey).toHaveBeenCalledWith(
      "wk_live",
      "https://example.com",
    )
    expect(rateLimitService.checkIngestRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj_1", appId: "app_1" }),
      1,
    )
  })
})
