import { createInMemoryQueue } from "./lib/queue"

/** 创建 Phase 1 的最小 worker 运行时。 */
export function createWorkerRuntime() {
  const queue = createInMemoryQueue()

  return {
    queue,
  }
}
