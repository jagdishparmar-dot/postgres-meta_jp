"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Cable, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DEFAULT_CONNECTION,
  type DbConnectionConfig,
  type SavedConnection,
} from "@/lib/connection"

function toFormState(
  initial?: Partial<DbConnectionConfig> | SavedConnection | null
): DbConnectionConfig {
  return {
    ...DEFAULT_CONNECTION,
    ...initial,
    password: "",
    id: initial && "id" in (initial || {}) ? (initial as SavedConnection).id : undefined,
  }
}

export function ConnectionForm({
  initial,
  onSaved,
}: {
  initial?: Partial<DbConnectionConfig> | SavedConnection | null
  onSaved?: (connection: SavedConnection) => void
}) {
  const router = useRouter()
  const [config, setConfig] = useState<DbConnectionConfig>(() =>
    toFormState(initial)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(config.id)

  useEffect(() => {
    setConfig(toFormState(initial))
  }, [initial])

  function update<K extends keyof DbConnectionConfig>(
    key: K,
    value: DbConnectionConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!isEdit && !config.password) {
        throw new Error("Password is required")
      }

      if (!isEdit || config.password) {
        const testRes = await fetch("/api/connection/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        })
        const testData = await testRes.json()
        if (!testRes.ok) {
          throw new Error(testData.error || "Connection failed")
        }
      }

      const body: Record<string, unknown> = {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        sslMode: config.sslMode,
        activate: true,
      }
      if (!isEdit || config.password) {
        body.password = config.password
      }

      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save connection")
      }

      const saved = data.connection as SavedConnection
      toast.success(
        testHint(data, saved)
      )
      onSaved?.(saved)
      router.push("/projects")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to connect to database"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full border-border/80 bg-card/80 shadow-xl shadow-black/20">
      <CardHeader>
        <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Cable className="size-4" />
        </div>
        <CardTitle>{isEdit ? "Edit connection" : "New connection"}</CardTitle>
        <CardDescription>
          Passwords are encrypted server-side — not stored in the browser.
        </CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Local Postgres"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={config.host}
                onChange={(e) => update("host", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={config.port}
                onChange={(e) => update("port", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="database">Database</Label>
            <Input
              id="database"
              value={config.database}
              onChange={(e) => update("database", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="user">User</Label>
              <Input
                id="user"
                value={config.user}
                onChange={(e) => update("user", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password{isEdit ? " (leave blank to keep)" : ""}
              </Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => update("password", e.target.value)}
                autoComplete="current-password"
                required={!isEdit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sslMode">SSL mode</Label>
            <select
              id="sslMode"
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={config.sslMode}
              onChange={(e) =>
                update("sslMode", e.target.value as DbConnectionConfig["sslMode"])
              }
            >
              <option value="disable">disable</option>
              <option value="prefer">prefer</option>
              <option value="require">require</option>
            </select>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfig(toFormState(null))}
            disabled={loading}
          >
            Reset
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? "Saving…" : isEdit ? "Save & connect" : "Connect"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function testHint(_data: unknown, saved: SavedConnection) {
  return `Connected · ${saved.name}`
}
