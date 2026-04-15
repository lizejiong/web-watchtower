import { and, eq } from "drizzle-orm"

import { events } from "../schema"

/** 事件天然幂等键。 */
export type EventIdentity = {
  projectId: string
  appId: string
  eventId: string
}

/** 构造事件去重查询条件。 */
export function buildEventDedupeWhere(identity: EventIdentity) {
  return and(
    eq(events.projectId, identity.projectId),
    eq(events.appId, identity.appId),
    eq(events.eventId, identity.eventId),
  )
}
