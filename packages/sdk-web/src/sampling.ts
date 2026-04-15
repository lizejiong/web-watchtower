import type { EventType } from "./config"

/** SDK 事件优先级，用于队列溢出时做淘汰决策。 */
export const EVENT_PRIORITY: Record<EventType, number> = {
  error: 5,
  request: 4,
  performance: 3,
  behavior: 2,
  custom: 2,
  breadcrumb: 1,
}

/** 根据事件类型和采样率决定是否保留事件。 */
export function shouldSampleEvent(
  type: EventType,
  sampleRate: number,
  random = Math.random(),
) {
  if (type === "error") {
    return true
  }

  return random <= sampleRate
}
