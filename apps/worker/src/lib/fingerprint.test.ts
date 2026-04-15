import { describe, expect, it } from "vitest"

import { buildErrorFingerprint } from "./fingerprint"

describe("buildErrorFingerprint", () => {
  it("normalizes dynamic ids from error messages", () => {
    const fingerprint = buildErrorFingerprint({
      type: "error",
      route: "/orders/123",
      payload: {
        message: "Order 998877 failed",
        stack: "Error: Order 998877 failed\n at checkout (app.ts:1:1)",
      },
      release: "web@abc123",
    } as never)

    expect(fingerprint).toContain("/orders/:id")
    expect(fingerprint).not.toContain("998877")
  })
})
