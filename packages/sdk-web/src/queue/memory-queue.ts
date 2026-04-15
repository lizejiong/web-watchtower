import { EVENT_PRIORITY } from "../sampling"
import type { EventType } from "../config"

/** SDK 内存队列条目。 */
export type MemoryQueueItem = {
  id: string
  type: EventType
}

/** Phase 1 的内存队列实现。 */
export class MemoryQueue<T extends MemoryQueueItem> {
  private readonly events: T[] = []

  constructor(private readonly maxSize: number) {}

  /** 推入事件并在溢出时淘汰优先级最低的最早事件。 */
  push(event: T) {
    this.events.push(event)

    while (this.events.length > this.maxSize) {
      const lowestPriorityIndex = this.events.reduce((lowestIndex, current, index, list) => {
        const currentPriority = EVENT_PRIORITY[current.type]
        const lowestPriority = EVENT_PRIORITY[list[lowestIndex]!.type]

        if (currentPriority < lowestPriority) {
          return index
        }

        return lowestIndex
      }, 0)

      this.events.splice(lowestPriorityIndex, 1)
    }
  }

  /** 读取当前内存队列快照。 */
  items() {
    return [...this.events]
  }

  /** flush 成功处理后，按事件 id 从内存队列中移除不需要重放的事件。 */
  removeByIds(ids: readonly string[]) {
    const idSet = new Set(ids)

    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (idSet.has(this.events[index]!.id)) {
        this.events.splice(index, 1)
      }
    }
  }
}
