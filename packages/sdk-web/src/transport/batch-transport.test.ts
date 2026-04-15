import { describe, expect, it, vi } from "vitest"

import { flushBatch } from "./batch-transport"

describe("flushBatch", () => {
  it("keeps only retryable rejected events for replay", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "bat_1",
        accepted: ["evt_1"],
        duplicated: ["evt_2"],
        rejected: [
          { eventId: "evt_3", reason: "temporarily_unavailable", retryable: true },
          { eventId: "evt_4", reason: "payload_too_large", retryable: false },
        ],
      }),
    })

    const result = await flushBatch(fetcher as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [{ id: "evt_1" }, { id: "evt_2" }, { id: "evt_3" }, { id: "evt_4" }],
    } as never)

    expect(result.retryableEventIds).toEqual(["evt_3"])
    expect(result.droppedEventIds).toEqual(["evt_4"])
    expect(result.acceptedEventIds).toEqual(["evt_1"])
    expect(result.duplicatedEventIds).toEqual(["evt_2"])
  })
})
