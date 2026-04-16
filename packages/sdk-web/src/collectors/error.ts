import { createRuntimeErrorEvent } from "../events/error"

export function createErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return createRuntimeErrorEvent(error)
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
  }
}
