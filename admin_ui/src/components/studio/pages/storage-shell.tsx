"use client"

import { type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { StudioShell } from "@/components/studio/studio-shell"
import { useStudioConnection } from "@/hooks/use-studio-connection"

export function StorageShell({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string
  subtitle?: string
  toolbar?: ReactNode
  children: ReactNode
}) {
  const { connection, ready } = useStudioConnection()

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <StudioShell
      connection={connection}
      title={title}
      subtitle={subtitle}
      toolbar={toolbar}
    >
      {children}
    </StudioShell>
  )
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
