import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../client"
import { projectApiKeys } from "../schema"

export async function findWriteKeyByHash(db: DatabaseClient, keyHash: string) {
  return db.query.projectApiKeys.findFirst({
    where: eq(projectApiKeys.keyHash, keyHash),
  })
}
