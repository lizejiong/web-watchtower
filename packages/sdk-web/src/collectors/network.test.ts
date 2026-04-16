import { describe, expect, it } from "vitest"

import { createFailedRequestPayload } from "./network"

describe("createFailedRequestPayload", () => {
  it("records failed request metadata", () => {
    expect(
      createFailedRequestPayload("https://example.com/api", { method: "POST" }, new Error("offline")),
    ).toEqual({
      method: "POST",
      ok: false,
      errorMessage: "offline",
    })
  })
})
