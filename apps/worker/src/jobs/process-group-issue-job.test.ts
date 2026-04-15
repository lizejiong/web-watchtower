import { describe, expect, it, vi } from "vitest"

import { processNextGroupIssueJob } from "./process-group-issue-job"

describe("processNextGroupIssueJob", () => {
  it("claims a pending job, groups the event, and completes the claim", async () => {
    const job = { id: "job_1", eventId: "evt_1", claimToken: "claim_1" }
    const queue = {
      claimNext: vi.fn().mockResolvedValue(job),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    }
    const eventReader = {
      findByEventId: vi.fn().mockResolvedValue({
        id: "evt_1",
        projectId: "proj_1",
        appId: "app_1",
        type: "error",
        route: "/orders/123",
        release: "web@abc123",
        occurredAt: new Date("2026-04-15T00:00:00.000Z"),
        payload: {
          message: "Order 998877 failed",
          stack: "Error: Order 998877 failed\n at checkout (app.ts:1:1)",
        },
      }),
    }
    const issues = {
      findIssueByFingerprint: vi.fn().mockResolvedValue(null),
      insertIssue: vi.fn().mockResolvedValue(undefined),
      incrementIssue: vi.fn().mockResolvedValue(undefined),
    }

    const processed = await processNextGroupIssueJob(queue, eventReader, issues)

    expect(processed).toBe(true)
    expect(issues.insertIssue).toHaveBeenCalledTimes(1)
    expect(queue.complete).toHaveBeenCalledWith(job)
    expect(queue.fail).not.toHaveBeenCalled()
  })

  it("fails the claimed job when the event is missing", async () => {
    const job = { id: "job_1", eventId: "evt_missing", claimToken: "claim_1" }
    const queue = {
      claimNext: vi.fn().mockResolvedValue(job),
      complete: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
    }
    const eventReader = {
      findByEventId: vi.fn().mockResolvedValue(null),
    }
    const issues = {
      findIssueByFingerprint: vi.fn(),
      insertIssue: vi.fn(),
      incrementIssue: vi.fn(),
    }

    const processed = await processNextGroupIssueJob(queue, eventReader, issues)

    expect(processed).toBe(false)
    expect(queue.fail).toHaveBeenCalledWith(job, "event_not_found")
    expect(queue.complete).not.toHaveBeenCalled()
    expect(issues.findIssueByFingerprint).not.toHaveBeenCalled()
  })
})
