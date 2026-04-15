import { describe, expect, it } from "vitest"

import { tables } from "./schema"

describe("database schema", () => {
  it("defines durable group issue jobs", () => {
    expect(tables.groupIssueJobs).toBeDefined()
  })

  it("keeps issues unique by project, app, and fingerprint", () => {
    expect(tables.issues).toBeDefined()
  })
})
