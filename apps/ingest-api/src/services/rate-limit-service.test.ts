import { describe, expect, it, vi } from "vitest"

import { checkIngestRateLimit } from "./rate-limit-service"

describe("checkIngestRateLimit", () => {
  const context = {
    projectId: "proj_1",
    appId: "app_1",
    hourlyQuota: 10,
    dailyQuota: 100,
    allowedOrigins: [],
  }

  it("rejects batches that exceed hourly quota", async () => {
    const repository = {
      countEventsSince: vi.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(9),
    }

    await expect(
      checkIngestRateLimit(
        repository,
        context,
        2,
        new Date("2026-04-15T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: "hourly_quota_exceeded",
    })
  })

  it("rejects batches that exceed daily quota", async () => {
    const repository = {
      countEventsSince: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(99),
    }

    await expect(
      checkIngestRateLimit(
        repository,
        context,
        2,
        new Date("2026-04-15T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: "daily_quota_exceeded",
    })
  })

  it("allows batches within quota", async () => {
    const repository = {
      countEventsSince: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
    }

    await expect(
      checkIngestRateLimit(
        repository,
        context,
        2,
        new Date("2026-04-15T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      allowed: true,
    })
  })
})
