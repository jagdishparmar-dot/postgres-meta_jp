"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Database,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/studio/confirm-dialog"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import type { ProjectRedisLink, RedisPlatformStatus } from "@/lib/redis/link"
import type { RedisInfoSummary, RedisKeyEntry } from "@/lib/redis/client"

type Ping = { ok: true; pong: string } | null

export function RedisPageClient() {
  const { project } = useProject()
  const { connection, ready } = useStudioConnection()
  const projectId = project?.id

  const [link, setLink] = useState<ProjectRedisLink | null>(null)
  const [platform, setPlatform] = useState<RedisPlatformStatus | null>(null)
  const [info, setInfo] = useState<RedisInfoSummary | null>(null)
  const [ping, setPing] = useState<Ping>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedDb, setSelectedDb] = useState<string>("")
  const [linking, setLinking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customUrl, setCustomUrl] = useState("")

  const [match, setMatch] = useState("*")
  const [cursor, setCursor] = useState("0")
  const [keys, setKeys] = useState<RedisKeyEntry[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [selected, setSelected] = useState<RedisKeyEntry | null>(null)
  const [detail, setDetail] = useState<{
    key: string
    type: string
    ttl: number
    value: unknown
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newTtl, setNewTtl] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<
    { type: "unlink" } | { type: "delete"; key: string } | null
  >(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load Redis")
      setLink(data.link)
      setPlatform(data.platform)
      setInfo(data.info)
      setPing(data.ping ?? null)
      setConnectionError(data.connection_error || null)
      if (
        data.platform?.available_dbs?.length &&
        selectedDb === ""
      ) {
        setSelectedDb(String(data.platform.available_dbs[0]))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadKeys = useCallback(
    async (nextCursor = "0", append = false) => {
      if (!projectId) return
      setKeysLoading(true)
      try {
        const qs = new URLSearchParams({
          match: match || "*",
          cursor: nextCursor,
          count: "50",
        })
        const res = await fetch(
          `/api/platform/projects/${projectId}/redis/keys?${qs}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to scan keys")
        setCursor(data.cursor)
        setKeys((prev) => (append ? [...prev, ...data.keys] : data.keys))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Scan failed")
      } finally {
        setKeysLoading(false)
      }
    },
    [projectId, match]
  )

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (link?.linked && !connectionError && projectId) {
      void loadKeys("0", false)
    } else {
      setKeys([])
      setSelected(null)
      setDetail(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.linked, connectionError, projectId])

  async function testShared() {
    if (!projectId) return
    setTesting(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          redis_db: selectedDb !== "" ? Number(selectedDb) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test failed")
      toast.success(`Connected — PING ${data.pong}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTesting(false)
    }
  }

  async function linkDb(auto = false) {
    if (!projectId) return
    setLinking(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_db",
          redis_db: auto || selectedDb === "" ? null : Number(selectedDb),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Link failed")
      setLink(data.link)
      setPlatform(data.platform)
      setInfo(data.info)
      setConnectionError(null)
      toast.success(`Linked to Redis DB ${data.link.db}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Link failed")
    } finally {
      setLinking(false)
    }
  }

  async function linkCustom() {
    if (!projectId) return
    setLinking(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_custom",
          redis_url: customUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Link failed")
      setLink(data.link)
      setPlatform(data.platform)
      setInfo(data.info)
      setConnectionError(null)
      toast.success("Custom Redis linked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Link failed")
    } finally {
      setLinking(false)
    }
  }

  async function unlinkRedis() {
    if (!projectId) return
    setConfirm({ type: "unlink" })
  }

  async function performUnlink() {
    if (!projectId) return
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unlink failed")
      setLink(data.link)
      setPlatform(data.platform)
      setInfo(null)
      setPing(null)
      toast.success("Redis unlinked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unlink failed")
    }
  }

  async function deleteKey(key: string) {
    if (!projectId) return
    setConfirm({ type: "delete", key })
  }

  async function performDeleteKey(key: string) {
    if (!projectId) return
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/redis/keys/${encodeURIComponent(key)}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast.success("Key deleted")
      if (selected?.key === key) {
        setSelected(null)
        setDetail(null)
      }
      await loadKeys("0", false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function openKey(entry: RedisKeyEntry) {
    if (!projectId) return
    setSelected(entry)
    setDetailLoading(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/redis/keys/${encodeURIComponent(entry.key)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load key")
      setDetail(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function saveKey() {
    if (!projectId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/redis/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey,
          value: newValue,
          ttl_seconds: newTtl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast.success("Key saved")
      setNewKey("")
      setNewValue("")
      setNewTtl("")
      await loadKeys("0", false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }


  useStudioPage({
    title: "Redis",
    subtitle: "Shared Redis — each project gets a logical DB (0–15)",
    onRefresh: () => void load(),
    refreshing: loading,
  })

  return (
    <>
      {loading || !link ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !link.linked ? (
        <div className="mx-auto max-w-xl space-y-4 p-6">
          {!platform?.configured ? (
            <Alert variant="destructive">
              <AlertTitle>REDIS_URL not configured</AlertTitle>
              <AlertDescription>
                Set <code>REDIS_URL</code> in <code>.env.local</code> (shared
                instance), then restart the Next.js server. Example:{" "}
                <code className="text-xs">
                  redis://:redislocal@localhost:6379
                </code>
                . Local helper:{" "}
                <code className="text-xs">
                  docker compose -f docker-compose.redis.yml up -d
                </code>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Database className="size-4" />
                <AlertTitle>Link a logical Redis DB</AlertTitle>
                <AlertDescription>
                  Shared instance{" "}
                  <code className="text-xs">{platform.url_masked}</code>. Each
                  project uses one DB index (0–15). Available:{" "}
                  {platform.available_dbs.length
                    ? platform.available_dbs.join(", ")
                    : "none"}
                  .
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="redis-db">Redis DB index</Label>
                <select
                  id="redis-db"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={selectedDb}
                  onChange={(e) => setSelectedDb(e.target.value)}
                >
                  <option value="">Auto (next free)</option>
                  {platform.available_dbs.map((db) => (
                    <option key={db} value={String(db)}>
                      DB {db}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void testShared()}
                  disabled={testing || linking}
                >
                  {testing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Database className="size-3.5" />
                  )}
                  Test connection
                </Button>
                <Button
                  size="sm"
                  onClick={() => void linkDb(false)}
                  disabled={linking || testing || !platform.available_dbs.length}
                >
                  {linking ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Link2 className="size-3.5" />
                  )}
                  Link DB
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void linkDb(true)}
                  disabled={linking || testing || !platform.available_dbs.length}
                >
                  Auto-assign
                </Button>
              </div>
            </>
          )}

          <div className="border-t border-border pt-4">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowCustom((v) => !v)}
            >
              {showCustom ? "Hide" : "Advanced"}: bring-your-own Redis URL
            </button>
            {showCustom ? (
              <div className="mt-3 space-y-2">
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="redis://:password@host:6379/0"
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void linkCustom()}
                  disabled={linking || !customUrl.trim()}
                >
                  Link custom URL
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-4 p-4">
          {connectionError ? (
            <Alert variant="destructive">
              <AlertTitle>Connection error</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
              {link.mode === "shared" ? `DB ${link.db}` : "custom"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {link.url_masked}
            </span>
            {ping ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                PING {ping.pong}
              </span>
            ) : null}
            {info?.redis_version ? (
              <span className="text-xs text-muted-foreground">
                v{info.redis_version}
                {info.used_memory_human
                  ? ` · ${info.used_memory_human}`
                  : ""}
              </span>
            ) : null}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void unlinkRedis()}
              >
                <Unlink className="size-3.5" />
                Unlink
              </Button>
            </div>
          </div>

          {!connectionError ? (
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="flex min-h-0 flex-col gap-2 rounded-md border border-border">
                <div className="flex items-center gap-2 border-b border-border p-2">
                  <Input
                    value={match}
                    onChange={(e) => setMatch(e.target.value)}
                    placeholder="MATCH pattern *"
                    className="font-mono text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void loadKeys("0", false)
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadKeys("0", false)}
                    disabled={keysLoading}
                  >
                    {keysLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Scan
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-2 py-1.5 font-medium">Key</th>
                        <th className="px-2 py-1.5 font-medium">Type</th>
                        <th className="px-2 py-1.5 font-medium">TTL</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr
                          key={k.key}
                          className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${
                            selected?.key === k.key ? "bg-muted/50" : ""
                          }`}
                          onClick={() => void openKey(k)}
                        >
                          <td className="max-w-[200px] truncate px-2 py-1.5 font-mono">
                            {k.key}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {k.type}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {k.ttl < 0 ? "—" : `${k.ttl}s`}
                          </td>
                          <td className="px-1 py-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                void deleteKey(k.key)
                              }}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!keys.length && !keysLoading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-2 py-6 text-center text-muted-foreground"
                          >
                            No keys matched
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {cursor !== "0" ? (
                  <div className="border-t border-border p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={keysLoading}
                      onClick={() => void loadKeys(cursor, true)}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-md border border-border p-3">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Plus className="size-3.5" /> Set string key
                  </h3>
                  <div className="space-y-2">
                    <Input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="key"
                      className="font-mono text-xs"
                    />
                    <Textarea
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="value"
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <Input
                      value={newTtl}
                      onChange={(e) => setNewTtl(e.target.value)}
                      placeholder="TTL seconds (optional)"
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => void saveKey()}
                      disabled={saving || !newKey.trim()}
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border p-3">
                  <h3 className="mb-2 text-sm font-medium">Value</h3>
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Loading…
                    </div>
                  ) : detail ? (
                    <div className="space-y-2 text-xs">
                      <p>
                        <span className="text-muted-foreground">key </span>
                        <code className="font-mono">{detail.key}</code>
                      </p>
                      <p>
                        <span className="text-muted-foreground">type </span>
                        {detail.type}
                        <span className="text-muted-foreground"> · ttl </span>
                        {detail.ttl < 0 ? "none" : `${detail.ttl}s`}
                      </p>
                      <pre className="overflow-auto rounded bg-muted/50 p-2 font-mono whitespace-pre-wrap">
                        {typeof detail.value === "string"
                          ? detail.value
                          : JSON.stringify(detail.value, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select a key to inspect
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    <ConfirmDialog
      open={Boolean(confirm)}
      onOpenChange={(open) => !open && setConfirm(null)}
      title={
        confirm?.type === "unlink"
          ? "Unlink Redis?"
          : `Delete key "${confirm?.type === "delete" ? confirm.key : ""}"?`
      }
      description={
        confirm?.type === "unlink"
          ? "Removes the link from this project. Keys on the Redis server are not deleted."
          : "This permanently deletes the key from Redis."
      }
      confirmLabel={confirm?.type === "unlink" ? "Unlink" : "Delete"}
      destructive
      onConfirm={async () => {
        if (!confirm) return
        if (confirm.type === "unlink") await performUnlink()
        else await performDeleteKey(confirm.key)
        setConfirm(null)
      }}
    />
    </>
  )
}
