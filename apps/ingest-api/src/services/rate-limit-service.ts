import type { WriteKeyContext } from "./key-service"

/** 限流检查结果。 */
export type RateLimitDecision = {
  allowed: boolean
  reason?: string
}

/** 限流服务接口。 */
export type RateLimitService = {
  checkIngestRateLimit: (
    context: WriteKeyContext,
  ) => Promise<RateLimitDecision>
}

/** Phase 1 的最小限流桩实现。 */
export async function checkIngestRateLimit(
  _context: WriteKeyContext,
): Promise<RateLimitDecision> {
  return {
    allowed: true,
  }
}
