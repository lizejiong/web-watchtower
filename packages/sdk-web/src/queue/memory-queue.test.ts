import { describe, expect, it } from "vitest"

import { MemoryQueue } from "./memory-queue"

describe("MemoryQueue", () => {
  it("drops oldest breadcrumb before dropping errors", () => {
    const queue = new MemoryQueue(2)

    queue.push({ id: "b1", type: "breadcrumb" } as never)
    queue.push({ id: "e1", type: "error" } as never)
    queue.push({ id: "e2", type: "error" } as never)

    expect(queue.items().map((item) => item.id)).toEqual(["e1", "e2"])
  })
})
