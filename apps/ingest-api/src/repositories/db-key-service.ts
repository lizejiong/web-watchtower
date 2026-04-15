import { findWriteKeyByHash, type DatabaseClient } from "@web-monitoring/db"

import { hashWriteKey } from "../lib/hash"
import { type KeyService, validateWriteKeyRecord } from "../services/key-service"

export function createDatabaseKeyService(db: DatabaseClient): KeyService {
  return {
    async validateWriteKey(writeKey, origin) {
      const record = await findWriteKeyByHash(db, hashWriteKey(writeKey))
      return validateWriteKeyRecord(record, origin)
    },
  }
}
