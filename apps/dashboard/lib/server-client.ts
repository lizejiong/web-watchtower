import type { DashboardMember } from "./auth"

export async function getDashboardMember(): Promise<DashboardMember> {
  return {
    role: "viewer",
    projectIds: ["demo-project"],
  }
}
