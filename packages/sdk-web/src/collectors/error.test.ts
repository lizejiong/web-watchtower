import { describe, expect, it } from "vitest"

import { createErrorPayload } from "./error"

describe("createErrorPayload", () => {
  it("normalizes unknown thrown values", () => {
    expect(createErrorPayload("boom")).toEqual({ message: "boom" })
  })
})
