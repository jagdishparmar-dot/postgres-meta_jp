"use client"

import { AdminLogoutButton } from "@/components/admin-logout-button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Keyboard, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProjectSwitcher } from "@/components/studio/project-switcher"
import { buildStudioBreadcrumbs } from "@/lib/platform/breadcrumbs"
import { useOptionalProject } from "@/lib/platform/project-context"
import type { SavedConnection } from "@/lib/connection"
import { cn } from "@/lib/utils"

type StudioTopbarProps = {
  title: string
  subtitle?: string
  connection: SavedConnection | null
  onRefresh?: () => void
  refreshing?: boolean
  onOpenShortcuts?: () => void
}

export function StudioTopbar({
  title,
  subtitle,
  connection,
  onRefresh,
  refreshing,
  onOpenShortcuts,
}: StudioTopbarProps) {
  const pathname = usePathname()
  const projectCtx = useOptionalProject()

  const breadcrumbs =
    projectCtx && pathname
      ? buildStudioBreadcrumbs({
          pathname,
          projectId: projectCtx.projectId,
          projectName: projectCtx.project.name,
          pageTitle: title,
        })
      : null

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/30 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {projectCtx ? (
          <ProjectSwitcher
            projectId={projectCtx.projectId}
            projectName={projectCtx.project.name}
          />
        ) : connection ? (
          <span className="truncate text-sm font-medium">{connection.name}</span>
        ) : null}

        {breadcrumbs && breadcrumbs.length > 1 ? (
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-1 md:flex"
          >
            {breadcrumbs.slice(1).map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate text-xs font-medium text-foreground">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <div className="min-w-0 md:hidden">
            <h1 className="truncate text-sm font-medium">{title}</h1>
          </div>
        )}

        {breadcrumbs && breadcrumbs.length <= 1 ? (
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium leading-tight">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs leading-tight text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : subtitle ? (
          <p className="hidden truncate text-xs text-muted-foreground lg:inline">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {connection ? (
          <Badge
            variant="outline"
            className={cn(
              "hidden max-w-[180px] truncate font-normal md:inline-flex",
              "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
            )}
          >
            <span className="mr-1.5 size-1.5 rounded-full bg-emerald-500" />
            {connection.database}
          </Badge>
        ) : null}

        {onRefresh ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        ) : null}

        {onOpenShortcuts ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="size-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
          </Button>
        ) : null}

        <AdminLogoutButton variant="ghost" size="sm" />
      </div>
    </header>
  )
}
