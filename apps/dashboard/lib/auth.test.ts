import { describe, expect, it } from "vitest"
import { canAccessProject } from "./auth"

describe("canAccessProject", () => {
  it("allows org_admin on any project", () => {
    expect(canAccessProject({ role: "org_admin", projectIds: [] }, "proj_1")).toBe(true)
  })

  it("denies viewer outside assigned projects", () => {
    expect(canAccessProject({ role: "viewer", projectIds: ["proj_2"] }, "proj_1")).toBe(false)
  })
})
