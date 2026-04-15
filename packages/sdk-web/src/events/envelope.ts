import type { EventType } from "../config"
import type { MemoryQueueItem } from "../queue/memory-queue"

export type SdkEventEnvelope = MemoryQueueItem & {
  batchId: string
  schemaVersion: 1
  timestamp: number
  projectId: string
  appId: string
  sessionId: string
  release?: string
  route?: string
  url: string
  tags: Record<string, string>
  context: Record<string, unknown>
  payload: Record<string, unknown>
}

export type EventEnvelopeInput = {
  projectId: string
  appId: string
  sessionId: string
  type: EventType
  url: string
  route?: string
  release?: string
  payload: Record<string, unknown>
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}_${randomId}`
}

export function createEventEnvelope(input: EventEnvelopeInput): SdkEventEnvelope {
  return {
    id: createId("evt"),
    batchId: createId("bat"),
    type: input.type,
    schemaVersion: 1,
    timestamp: Date.now(),
    projectId: input.projectId,
    appId: input.appId,
    sessionId: input.sessionId,
    release: input.release,
    route: input.route,
    url: input.url,
    tags: {},
    context: {},
    payload: input.payload,
  }
}
