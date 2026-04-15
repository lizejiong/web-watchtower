import { describe, expect, it } from "vitest"

import { getRetryableRejectedEventIds } from "./retry"

describe("getRetryableRejectedEventIds", () => {
  it("returns only retryable rejected ids", () => {
    const eventIds = getRetryableRejectedEventIds([
      { eventId: "evt_1", reason: "temporary", retryable: true },
      { eventId: "evt_2", reason: "payload_too_large", retryable: false },
      { eventId: "evt_3", reason: "network", retryable: true },
    ])

    expect(eventIds).toEqual(["evt_1", "evt_3"])
  })
})
