"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Hexagon, Loader2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Health = {
  ok: boolean
  configured: boolean
  migrated: boolean
  schemaVersion: string | null
  masterConfigured?: boolean
  platformConfigured?: boolean
  masterDatabase?: string | null
  platformDatabase?: string | null
  error?: string
}

export default function SetupPage() {
  const router = useRouter()
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/health", { cache: "no-store" })
      const data = (await res.json()) as Health
      setHealth(data)
      if (data.ok) {
        router.replace("/projects")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.1_250_/_0.35),_transparent_55%)]" />
      <div className="relative z-10 mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Hexagon className="size-5" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Platform setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One master instance URL + one platform datastore URL
          </p>
        </div>
      </div>

      <Card className="relative z-10 w-full max-w-xl border-border/80 bg-card/80 shadow-xl shadow-black/20">
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>
            Credentials stay in <code className="text-xs">.env.local</code>.
            Projects store only a database name; Studio uses the master URL to
            reach that database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading && !health ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking platform…
            </div>
          ) : null}

          {health?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{health.error}</AlertDescription>
            </Alert>
          ) : null}

          <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
            <li>
              Copy <code className="text-xs text-foreground">.env.example</code>{" "}
              to <code className="text-xs text-foreground">.env.local</code>
            </li>
            <li>
              Set{" "}
              <code className="text-xs text-foreground">PG_MASTER_URL</code> to
              your Postgres instance (any DB on that server, usually{" "}
              <code className="text-xs">postgres</code>)
            </li>
            <li>
              Set{" "}
              <code className="text-xs text-foreground">PLATFORM_DATABASE_URL</code>{" "}
              to the control database (e.g.{" "}
              <code className="text-xs">pgadmin_platform</code>)
            </li>
            <li>
              Run setup:
              <pre className="mt-1.5 overflow-x-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] text-foreground">
                npm run platform:setup
              </pre>
            </li>
            <li>
              Restart <code className="text-xs">npm run dev</code> and refresh
            </li>
          </ol>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="mb-1 font-medium text-foreground">Status</p>
            <p>
              Master URL:{" "}
              {health?.masterConfigured
                ? health.masterDatabase || "yes"
                : "missing"}
            </p>
            <p>
              Platform URL:{" "}
              {health?.platformConfigured
                ? health.platformDatabase || "yes"
                : "missing"}
            </p>
            <p>Migrated: {health?.migrated ? "yes" : "no"}</p>
            {health?.schemaVersion ? (
              <p>Schema version: {health.schemaVersion}</p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-border/60">
          <Button onClick={() => void refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Terminal className="size-4" />
            )}
            Recheck
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
