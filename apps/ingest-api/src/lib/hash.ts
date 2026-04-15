import { createHash } from "node:crypto"

export function hashWriteKey(writeKey: string) {
  return createHash("sha256").update(writeKey).digest("hex")
}
