import { and, eq, gte, sql } from "drizzle-orm"

import type { DatabaseClient } from "../client"
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

export async function countProjectEventsSince(
  db: DatabaseClient,
  identity: { projectId: string; appId: string },
  since: Date,
) {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.projectId, identity.projectId),
        eq(events.appId, identity.appId),
        gte(events.receivedAt, since),
      ),
    )

  return rows[0]?.count ?? 0
}
