import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ACTIVE_PROJECT_COOKIE } from "@/lib/connection-session"
import { nestDatabasePath, studioPath } from "@/lib/platform/paths"

type PageProps = {
  params: Promise<{ slug?: string[] }>
}

export default async function LegacyDatabaseRedirect({ params }: PageProps) {
  const { slug } = await params
  const cookieStore = await cookies()
  const projectId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value

  if (!projectId) {
    redirect("/projects")
  }

  if (!slug?.length) {
    redirect(studioPath(projectId, "/schemas"))
  }

  const legacyPath = `/database/${slug.join("/")}`
  redirect(nestDatabasePath(projectId, legacyPath))
}
