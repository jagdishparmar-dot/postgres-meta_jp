"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { StudioShell } from "@/components/studio/studio-shell"
import { PageLoader } from "@/components/studio/page-loader"
import {
  StudioPageMetaProvider,
  useStudioPageMetaContext,
} from "@/components/studio/studio-page-meta"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { getStudioRouteMeta } from "@/lib/platform/studio-routes"

function StudioDatabaseLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { connection, ready } = useStudioConnection()
  const metaCtx = useStudioPageMetaContext()
  const route = getStudioRouteMeta(pathname)
  const meta = metaCtx?.meta ?? {}

  if (!ready || !connection) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <PageLoader label="Connecting…" />
      </div>
    )
  }

  return (
    <StudioShell
      connection={connection}
      title={meta.title ?? route.title}
      subtitle={meta.subtitle ?? route.subtitle}
      onRefresh={meta.onRefresh}
      refreshing={meta.refreshing}
      toolbar={meta.toolbar}
      contentVariant={meta.contentVariant ?? "default"}
    >
      {children}
    </StudioShell>
  )
}

export function StudioDatabaseLayout({ children }: { children: ReactNode }) {
  return (
    <StudioPageMetaProvider>
      <StudioDatabaseLayoutInner>{children}</StudioDatabaseLayoutInner>
    </StudioPageMetaProvider>
  )
}
