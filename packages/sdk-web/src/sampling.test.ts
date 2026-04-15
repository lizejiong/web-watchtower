import { describe, expect, it } from "vitest"

import { shouldSampleEvent } from "./sampling"

describe("shouldSampleEvent", () => {
  it("always keeps error events at sample rate 1", () => {
    expect(shouldSampleEvent("error", 1)).toBe(true)
  })
})
