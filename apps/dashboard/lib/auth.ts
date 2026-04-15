export type DashboardRole = "org_admin" | "project_admin" | "developer" | "viewer"

export type DashboardMember = {
  role: DashboardRole
  projectIds: string[]
}

export function canAccessProject(member: DashboardMember, projectId: string) {
  if (member.role === "org_admin") {
    return true
  }

  return member.projectIds.includes(projectId)
}
