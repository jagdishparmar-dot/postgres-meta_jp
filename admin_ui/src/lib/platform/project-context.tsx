"use client"

import {
  createContext,
  useContext,
  type ReactNode,
} from "react"
import type { PlatformProject } from "@/lib/platform/types"

type ProjectContextValue = {
  projectId: string
  project: PlatformProject
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  project,
  children,
}: {
  project: PlatformProject
  children: ReactNode
}) {
  return (
    <ProjectContext.Provider value={{ projectId: project.id, project }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider")
  }
  return ctx
}

export function useOptionalProject(): ProjectContextValue | null {
  return useContext(ProjectContext)
}
