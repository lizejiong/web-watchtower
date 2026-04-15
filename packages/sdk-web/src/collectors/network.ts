export function createFailedRequestPayload(
  _input: RequestInfo | URL,
  init: RequestInit | undefined,
  error: unknown,
) {
  return {
    method: init?.method ?? "GET",
    ok: false,
    errorMessage: error instanceof Error ? error.message : String(error),
  }
}
