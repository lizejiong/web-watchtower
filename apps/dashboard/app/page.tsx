import Link from "next/link"

export default function DashboardHomePage() {
  return (
    <main>
      <h1>Monitoring Dashboard</h1>
      <p>Phase 1 dashboard shell with scoped project access.</p>
      <ul>
        <li>
          <Link href="/login">Login</Link>
        </li>
        <li>
          <Link href="/projects/demo-project">Open Demo Project</Link>
        </li>
      </ul>
    </main>
  )
}
