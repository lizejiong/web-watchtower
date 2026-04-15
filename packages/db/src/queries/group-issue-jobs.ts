import type { DatabaseClient } from "../client"
import { groupIssueJobs } from "../schema"

export async function enqueueGroupIssueJob(db: DatabaseClient, eventId: string) {
  await db.insert(groupIssueJobs).values({ eventId }).onConflictDoNothing()
}
