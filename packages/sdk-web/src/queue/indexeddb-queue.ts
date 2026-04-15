import type { MemoryQueueItem } from "./memory-queue"

/** IndexedDB 队列占位实现，后续任务再接入真实持久化。 */
export class IndexedDbQueue<T extends MemoryQueueItem> {
  /** 读取待回放事件。 */
  async items(): Promise<T[]> {
    return []
  }

  /** 持久化单条事件。 */
  async push(_event: T): Promise<void> {}
}
