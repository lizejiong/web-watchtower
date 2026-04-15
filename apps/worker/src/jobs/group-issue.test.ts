import { describe, expect, it, vi } from "vitest"

import { groupIssue } from "./group-issue"

describe("groupIssue", () => {
  it("creates a new issue when fingerprint is first seen", async () => {
    const repository = {
      findIssueByFingerprint: vi.fn().mockResolvedValue(null),
      insertIssue: vi.fn().mockResolvedValue(undefined),
      incrementIssue: vi.fn(),
    }

    await groupIssue(repository, {
      id: "evt_1",
      projectId: "proj_1",
      appId: "app_1",
      type: "error",
      route: "/orders/123",
      release: "web@abc123",
      occurredAt: new Date("2026-04-15T00:00:00.000Z"),
      payload: {
        message: "playground runtime error 998877",
        stack: "Error: playground runtime error 998877\n at checkout (app.ts:1:1)",
      },
    })

    expect(repository.findIssueByFingerprint).toHaveBeenCalledWith(
      {
        projectId: "proj_1",
        appId: "app_1",
        fingerprint:
          "/orders/:id::playground runtime error :num::at checkout (app.ts:1:1)::web@abc123",
      },
    )
    expect(repository.insertIssue).toHaveBeenCalledWith({
      projectId: "proj_1",
      appId: "app_1",
      fingerprint:
        "/orders/:id::playground runtime error :num::at checkout (app.ts:1:1)::web@abc123",
      firstSeenAt: new Date("2026-04-15T00:00:00.000Z"),
      lastSeenAt: new Date("2026-04-15T00:00:00.000Z"),
      lastEventId: "evt_1",
    })
    expect(repository.incrementIssue).not.toHaveBeenCalled()
  })

  it("increments an existing issue when fingerprint already exists", async () => {
    const repository = {
      findIssueByFingerprint: vi.fn().mockResolvedValue({ id: "issue_1", occurrences: 4 }),
      insertIssue: vi.fn(),
      incrementIssue: vi.fn().mockResolvedValue(undefined),
    }

    await groupIssue(repository, {
      id: "evt_2",
      projectId: "proj_1",
      appId: "app_1",
      type: "error",
      route: "/orders/456",
      release: "web@abc123",
      occurredAt: new Date("2026-04-15T00:01:00.000Z"),
      payload: {
        message: "Order 112233 failed",
        stack: "Error: Order 112233 failed\n at checkout (app.ts:1:1)",
      },
    })

    expect(repository.insertIssue).not.toHaveBeenCalled()
    expect(repository.incrementIssue).toHaveBeenCalledWith(
      "issue_1",
      "evt_2",
      new Date("2026-04-15T00:01:00.000Z"),
    )
  })
})
