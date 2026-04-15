import { describe, expect, it } from "vitest"

import { tables } from "./schema"

describe("database schema", () => {
  it("defines event and issue tables", () => {
    expect(tables.events).toBeDefined()
    expect(tables.issues).toBeDefined()
    expect(tables.projectApiKeys).toBeDefined()
  })
})
