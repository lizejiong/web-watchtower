import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../client"
import { issues } from "../schema"

export async function listProjectIssues(db: DatabaseClient, projectId: string) {
  return db.query.issues.findMany({
    where: eq(issues.projectId, projectId),
    orderBy: (table, { desc }) => [desc(table.lastSeenAt)],
  })
}
