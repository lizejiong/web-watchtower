import { canAccessProject } from "../../../lib/auth"
import { getDashboardMember } from "../../../lib/server-client"

type ProjectPageProps = {
  params: Promise<{ projectId: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const [{ projectId }, member] = await Promise.all([params, getDashboardMember()])

  if (!canAccessProject(member, projectId)) {
    return <div>Forbidden</div>
  }

  return (
    <main>
      <h1>Project: {projectId}</h1>
      <p>Protected project shell for the initial dashboard slice.</p>
    </main>
  )
}
