"use client"

import { type ReactNode } from "react"
import { useStudioPage } from "@/components/studio/studio-page-meta"

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
  useStudioPage({ title, subtitle, toolbar })
  return <>{children}</>
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
