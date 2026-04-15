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
      type: "error",
      route: "/orders/123",
      release: "web@abc123",
      payload: {
        message: "playground runtime error 998877",
        stack: "Error: playground runtime error 998877\n at checkout (app.ts:1:1)",
      },
    })

    expect(repository.findIssueByFingerprint).toHaveBeenCalledWith(
      "/orders/:id::playground runtime error :num::at checkout (app.ts:1:1)::web@abc123",
    )
    expect(repository.insertIssue).toHaveBeenCalledTimes(1)
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
      type: "error",
      route: "/orders/456",
      release: "web@abc123",
      payload: {
        message: "Order 112233 failed",
        stack: "Error: Order 112233 failed\n at checkout (app.ts:1:1)",
      },
    })

    expect(repository.insertIssue).not.toHaveBeenCalled()
    expect(repository.incrementIssue).toHaveBeenCalledWith("issue_1", "evt_2")
  })
})
