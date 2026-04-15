import {
  countProjectEventsSince,
  type DatabaseClient,
} from "@web-monitoring/db"

import type { WriteKeyContext } from "./key-service"

export type RateLimitDecision = {
  allowed: boolean
  reason?: string
}

export type RateLimitService = {
  checkIngestRateLimit: (
    context: WriteKeyContext,
    eventCount: number,
  ) => Promise<RateLimitDecision>
}

export type RateLimitRepository = {
  countEventsSince: (
    context: Pick<WriteKeyContext, "projectId" | "appId">,
    since: Date,
  ) => Promise<number>
}

export async function checkIngestRateLimit(
  repository: RateLimitRepository,
  context: WriteKeyContext,
  eventCount: number,
  now = new Date(),
): Promise<RateLimitDecision> {
  const hourlySince = new Date(now.getTime() - 60 * 60 * 1000)
  const dailySince = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const hourlyCount = await repository.countEventsSince(context, hourlySince)
  const dailyCount = await repository.countEventsSince(context, dailySince)

  if (hourlyCount + eventCount > context.hourlyQuota) {
    return { allowed: false, reason: "hourly_quota_exceeded" }
  }

  if (dailyCount + eventCount > context.dailyQuota) {
    return { allowed: false, reason: "daily_quota_exceeded" }
  }

  return { allowed: true }
}

export function createRateLimitService(repository: RateLimitRepository): RateLimitService {
  return {
    checkIngestRateLimit: (context, eventCount) =>
      checkIngestRateLimit(repository, context, eventCount),
  }
}

export function createDatabaseRateLimitService(db: DatabaseClient): RateLimitService {
  return createRateLimitService({
    countEventsSince: (context, since) => countProjectEventsSince(db, context, since),
  })
}
