"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState, type ComponentType } from "react"
import {
  Activity,
  Archive,
  Boxes,
  Clock,
  Database,
  Eye,
  FileCode2,
  FolderKanban,
  FunctionSquare,
  GitFork,
  Globe,
  HardDrive,
  Hexagon,
  Home,
  KeyRound,
  Layers,
  ListTree,
  Lock,
  Megaphone,
  Puzzle,
  ScrollText,
  Search,
  Settings2,
  Shield,
  SlidersHorizontal,
  Table2,
  TableProperties,
  TerminalSquare,
  Timer,
  Type,
  Users,
  Wrench,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TableEditorNav } from "@/components/studio/table-editor-nav"
import { useOptionalProject } from "@/lib/platform/project-context"
import { projectOverviewPath, projectSettingsPath, studioPath } from "@/lib/platform/paths"

type NavIcon = ComponentType<{ className?: string }>

type SecondaryItem = {
  path: string
  label: string
  icon: NavIcon
}

type SecondarySection = {
  label: string
  items: SecondaryItem[]
}

type StudioModule = {
  id: string
  label: string
  icon: NavIcon
  defaultPath?: string
  matchPaths: string[]
  comingSoon?: boolean
  sections?: SecondarySection[]
}

const MODULES: StudioModule[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    matchPaths: [],
  },
  {
    id: "editor",
    label: "Table Editor",
    icon: Table2,
    defaultPath: "/tables",
    matchPaths: ["/tables", "/foreign-tables", "/views", "/materialized-views"],
    sections: [
      {
        label: "All tables",
        items: [
          { path: "/tables", label: "Tables", icon: Table2 },
          {
            path: "/foreign-tables",
            label: "Foreign tables",
            icon: TableProperties,
          },
        ],
      },
      {
        label: "All views",
        items: [
          { path: "/views", label: "Views", icon: Eye },
          {
            path: "/materialized-views",
            label: "Materialized views",
            icon: Boxes,
          },
        ],
      },
    ],
  },
  {
    id: "sql",
    label: "SQL Editor",
    icon: TerminalSquare,
    defaultPath: "/sql",
    matchPaths: ["/sql"],
    sections: [
      {
        label: "Editor",
        items: [{ path: "/sql", label: "SQL Editor", icon: TerminalSquare }],
      },
    ],
  },
  {
    id: "database",
    label: "Database",
    icon: Database,
    defaultPath: "/schemas",
    matchPaths: [
      "/schemas",
      "/functions",
      "/types",
      "/indexes",
      "/triggers",
      "/extensions",
      "/publications",
      "/diagram",
      "/roles",
      "/policies",
      "/privileges",
      "/generators",
      "/config",
      "/logs",
      "/backup",
      "/cron",
      "/pg-net",
      "/settings",
    ],
    sections: [
      {
        label: "Schema",
        items: [
          { path: "/schemas", label: "Schemas", icon: Layers },
          { path: "/functions", label: "Functions", icon: FunctionSquare },
          { path: "/types", label: "Types", icon: Type },
        ],
      },
      {
        label: "Security",
        items: [
          { path: "/roles", label: "Roles", icon: Users },
          { path: "/policies", label: "Policies", icon: Shield },
          { path: "/privileges", label: "Privileges", icon: KeyRound },
        ],
      },
      {
        label: "Objects",
        items: [
          { path: "/indexes", label: "Indexes", icon: ListTree },
          { path: "/triggers", label: "Triggers", icon: Zap },
          { path: "/extensions", label: "Extensions", icon: Puzzle },
          { path: "/publications", label: "Publications", icon: Megaphone },
          { path: "/diagram", label: "ER diagram", icon: GitFork },
        ],
      },
      {
        label: "Tools",
        items: [
          { path: "/generators", label: "Generators", icon: FileCode2 },
          { path: "/cron", label: "Cron", icon: Clock },
          { path: "/pg-net", label: "HTTP (pg_net)", icon: Globe },
          { path: "/config", label: "Config", icon: SlidersHorizontal },
          { path: "/logs", label: "Logs", icon: ScrollText },
          { path: "/backup", label: "Backup", icon: Archive },
        ],
      },
      {
        label: "Project",
        items: [
          { path: "/settings", label: "API & settings", icon: Settings2 },
        ],
      },
    ],
  },
  {
    id: "auth",
    label: "Authentication",
    icon: Lock,
    comingSoon: true,
    matchPaths: [],
  },
  {
    id: "storage",
    label: "Storage",
    icon: HardDrive,
    defaultPath: "/storage",
    matchPaths: [
      "/storage",
      "/storage/policies",
      "/storage/security",
      "/storage/usage",
      "/storage/orphans",
      "/storage/lifecycle",
      "/storage/audit",
    ],
    sections: [
      {
        label: "Files",
        items: [
          { path: "/storage", label: "Buckets", icon: HardDrive },
        ],
      },
      {
        label: "Access",
        items: [
          { path: "/storage/policies", label: "Policies", icon: Shield },
          { path: "/storage/security", label: "Security", icon: Lock },
        ],
      },
      {
        label: "Ops",
        items: [
          { path: "/storage/usage", label: "Usage", icon: HardDrive },
          { path: "/storage/orphans", label: "Orphans", icon: Wrench },
          { path: "/storage/lifecycle", label: "Lifecycle", icon: Timer },
          { path: "/storage/audit", label: "Audit log", icon: ScrollText },
        ],
      },
    ],
  },
  {
    id: "ops",
    label: "Ops",
    icon: Activity,
    defaultPath: "/ops",
    matchPaths: ["/ops"],
    sections: [
      {
        label: "Monitoring",
        items: [{ path: "/ops", label: "Ops hub", icon: Activity }],
      },
    ],
  },
]

function detectModuleId(
  pathname: string,
  projectId: string | undefined
): string {
  if (!projectId) return "editor"
  if (pathname === projectOverviewPath(projectId)) return "home"

  const base = `/projects/${projectId}/database`
  if (!pathname.startsWith(base)) return "editor"
  const rest = pathname.slice(base.length) || "/"

  for (const mod of MODULES) {
    if (mod.comingSoon || mod.id === "home") continue
    for (const p of mod.matchPaths) {
      if (rest === p || rest.startsWith(`${p}/`)) return mod.id
    }
  }
  return "database"
}

export function StudioSidebar({
  projectName,
  onOpenSearch,
}: {
  projectName: string
  onOpenSearch?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const projectCtx = useOptionalProject()
  const projectId = projectCtx?.projectId

  const activeModuleId = useMemo(
    () => detectModuleId(pathname, projectId),
    [pathname, projectId]
  )

  const [filter, setFilter] = useState("")
  const activeModule =
    MODULES.find((m) => m.id === activeModuleId) ??
    MODULES.find((m) => m.id === "editor")!

  function hrefFor(path: string) {
    if (!projectId) return `/database${path}`
    return studioPath(projectId, path)
  }

  function activateModule(mod: StudioModule) {
    if (mod.comingSoon) return
    if (mod.id === "home") {
      if (projectId) router.push(projectOverviewPath(projectId))
      return
    }
    if (mod.defaultPath) {
      router.push(hrefFor(mod.defaultPath))
    }
  }

  const filterLower = filter.trim().toLowerCase()
  const visibleSections = (activeModule.sections || [])
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !filterLower || item.label.toLowerCase().includes(filterLower)
      ),
    }))
    .filter((section) => section.items.length > 0)

  const isEditorWithProject =
    activeModule.id === "editor" && Boolean(projectId)

  const showSecondary =
    activeModule.id !== "home" &&
    !activeModule.comingSoon &&
    (isEditorWithProject || Boolean(activeModule.sections?.length))

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-svh shrink-0">
        {/* Primary icon rail — Supabase Studio style */}
        <aside className="flex w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2 dark:bg-[oklch(0.12_0.01_250)]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={projectId ? projectOverviewPath(projectId) : "/projects"}
                  className="mb-3 flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                />
              }
            >
              <Hexagon className="size-4" strokeWidth={2.5} />
            </TooltipTrigger>
            <TooltipContent side="right">{projectName}</TooltipContent>
          </Tooltip>

          <nav className="flex flex-1 flex-col items-center gap-1">
            {MODULES.map((mod) => {
              const Icon = mod.icon
              const active = activeModuleId === mod.id
              const disabled = Boolean(mod.comingSoon)
              return (
                <Tooltip key={mod.id}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={mod.label}
                        onClick={() => activateModule(mod)}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md transition-colors",
                          active && !disabled
                            ? "bg-white/10 text-foreground"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                          disabled && "cursor-not-allowed opacity-35"
                        )}
                      />
                    }
                  >
                    <Icon
                      className={cn(
                        "size-[18px]",
                        active && !disabled && "text-primary"
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {mod.label}
                    {disabled ? " — coming soon" : ""}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          <div className="mt-auto flex flex-col items-center gap-1 pt-2">
            {onOpenSearch ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Search"
                      onClick={onOpenSearch}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    />
                  }
                >
                  <Search className="size-[18px]" />
                </TooltipTrigger>
                <TooltipContent side="right">Search ⌘K</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/projects"
                    aria-label="Projects"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  />
                }
              >
                <FolderKanban className="size-[18px]" />
              </TooltipTrigger>
              <TooltipContent side="right">Projects</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={
                      projectId
                        ? projectSettingsPath(projectId)
                        : "/projects"
                    }
                    aria-label="Settings"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground",
                      pathname.includes("/settings") &&
                        "bg-white/10 text-foreground"
                    )}
                  />
                }
              >
                <Settings2 className="size-[18px]" />
              </TooltipTrigger>
              <TooltipContent side="right">API & settings</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Secondary contextual sidebar */}
        {showSecondary ? (
          <aside className="flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex h-12 shrink-0 flex-col justify-center border-b border-sidebar-border px-3">
              <p className="truncate text-sm font-medium text-foreground">
                {activeModule.label}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {projectName}
              </p>
            </div>

            {isEditorWithProject ? (
              <TableEditorNav
                projectId={projectId!}
                filter={filter}
                onFilterChange={setFilter}
                onCreateTable={() =>
                  router.push(studioPath(projectId!, "/tables"))
                }
              />
            ) : (
              <>
                <div className="border-b border-sidebar-border p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder={`Search ${activeModule.label.toLowerCase()}…`}
                      className="h-8 border-border/80 bg-background/40 pl-8 text-xs"
                    />
                  </div>
                </div>

                <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
                  {visibleSections.length === 0 ? (
                    <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
                      No matches
                    </p>
                  ) : (
                    visibleSections.map((section) => (
                      <div key={section.label} className="space-y-0.5">
                        <p className="px-2.5 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                          {section.label}
                        </p>
                        {section.items.map((item) => {
                          const Icon = item.icon
                          const href = hrefFor(item.path)
                          const active =
                            pathname === href ||
                            pathname.startsWith(`${href}/`)
                          return (
                            <Link
                              key={item.path}
                              href={href}
                              className={cn(
                                "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                                active
                                  ? "bg-sidebar-accent text-foreground"
                                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                              )}
                            >
                              <Icon
                                className={cn(
                                  "size-3.5 shrink-0",
                                  active
                                    ? "text-primary"
                                    : "text-muted-foreground group-hover:text-foreground"
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    ))
                  )}
                </nav>
              </>
            )}

            <div className="border-t border-sidebar-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
                onClick={() =>
                  projectId
                    ? router.push(projectOverviewPath(projectId))
                    : router.push("/projects")
                }
              >
                <Home className="size-3.5" />
                Project overview
              </Button>
            </div>
          </aside>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
