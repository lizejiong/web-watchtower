import { describe, expect, it } from "vitest"

import { hashWriteKey } from "../lib/hash"
import { validateWriteKeyRecord } from "./key-service"

describe("write key validation", () => {
  it("hashes write keys with sha256", () => {
    expect(hashWriteKey("wk_live")).toHaveLength(64)
    expect(hashWriteKey("wk_live")).toBe(hashWriteKey("wk_live"))
    expect(hashWriteKey("wk_live")).not.toBe(hashWriteKey("wk_other"))
  })

  it("returns context for active, unexpired, origin-allowed keys", () => {
    const context = validateWriteKeyRecord(
      {
        projectId: "proj_1",
        appId: "app_1",
        status: "active",
        allowedOrigins: ["https://example.com"],
        hourlyQuota: 100,
        dailyQuota: 1_000,
        expiresAt: new Date("2026-04-16T00:00:00.000Z"),
      },
      "https://example.com",
      new Date("2026-04-15T00:00:00.000Z"),
    )

    expect(context).toEqual({
      projectId: "proj_1",
      appId: "app_1",
      hourlyQuota: 100,
      dailyQuota: 1_000,
      allowedOrigins: ["https://example.com"],
    })
  })

  it("rejects disabled, expired, and disallowed-origin keys", () => {
    const baseRecord = {
      projectId: "proj_1",
      appId: "app_1",
      status: "active",
      allowedOrigins: ["https://example.com"],
      hourlyQuota: 100,
      dailyQuota: 1_000,
      expiresAt: null,
    }
    const now = new Date("2026-04-15T00:00:00.000Z")

    expect(validateWriteKeyRecord({ ...baseRecord, status: "disabled" }, undefined, now)).toBeNull()
    expect(
      validateWriteKeyRecord(
        { ...baseRecord, expiresAt: new Date("2026-04-14T00:00:00.000Z") },
        undefined,
        now,
      ),
    ).toBeNull()
    expect(validateWriteKeyRecord(baseRecord, "https://evil.example", now)).toBeNull()
  })
})
