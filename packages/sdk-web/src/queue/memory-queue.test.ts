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

  it("removes events by id after a flush result is handled", () => {
    const queue = new MemoryQueue(3)
    queue.push({ id: "evt_1", type: "error" } as never)
    queue.push({ id: "evt_2", type: "request" } as never)
    queue.push({ id: "evt_3", type: "error" } as never)

    queue.removeByIds(["evt_1", "evt_3"])

    expect(queue.items().map((item) => item.id)).toEqual(["evt_2"])
  })
})
