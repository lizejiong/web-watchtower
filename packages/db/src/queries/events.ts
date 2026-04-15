import { randomUUID } from "node:crypto"

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

export type InsertEventInput = {
  id?: string
  projectId: string
  appId: string
  eventId: string
  batchId: string
  type: string
  sessionId: string
  release?: string | null
  route?: string | null
  payload: Record<string, unknown>
  tags: Record<string, string>
  context: Record<string, unknown>
  occurredAt: Date
  receivedAt?: Date
}

export type EventInsertResult = {
  accepted: boolean
  status: "accepted" | "duplicate"
}

export async function insertEventWithDedupe(db: DatabaseClient, event: InsertEventInput) {
  const rows = await db
    .insert(events)
    .values({
      ...event,
      id: event.id ?? randomUUID(),
    })
    .onConflictDoNothing()
    .returning({ id: events.id })

  return {
    accepted: rows.length > 0,
    status: rows.length > 0 ? "accepted" : "duplicate",
  } satisfies EventInsertResult
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

  return Number(rows[0]?.count ?? 0)
}
