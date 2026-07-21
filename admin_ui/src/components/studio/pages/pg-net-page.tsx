"use client"

import { useCallback, useEffect, useState } from "react"
import { Globe, Loader2, RefreshCw, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import type { PgNetQueueItem, PgNetResponse } from "@/lib/pg-net"

type Status = { installed: boolean; available: boolean; error?: string }

export function PgNetPageClient() {
  const { connection, ready } = useStudioConnection()
  const [status, setStatus] = useState<Status | null>(null)
  const [responses, setResponses] = useState<PgNetResponse[]>([])
  const [queue, setQueue] = useState<PgNetQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)
  const [sending, setSending] = useState(false)

  const [method, setMethod] = useState<"GET" | "POST" | "DELETE">("GET")
  const [url, setUrl] = useState("https://httpbin.org/get")
  const [headersJson, setHeadersJson] = useState('{\n  "Accept": "application/json"\n}')
  const [bodyJson, setBodyJson] = useState("{\n  \n}")
  const [timeoutMs, setTimeoutMs] = useState("5000")
  const [selected, setSelected] = useState<PgNetResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/pg-net?limit=50")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load pg_net")
      setStatus(data.status)
      setResponses(data.responses || [])
      setQueue(data.queue || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function enable() {
    setEnabling(true)
    try {
      const res = await fetch("/api/platform/pg-net", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Enable failed")
      toast.success("pg_net enabled")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enable failed")
    } finally {
      setEnabling(false)
    }
  }

  async function send() {
    setSending(true)
    try {
      let headers: Record<string, string> = {}
      try {
        headers = JSON.parse(headersJson || "{}")
      } catch {
        throw new Error("Headers must be valid JSON")
      }
      let body: string | undefined
      if (method === "POST") {
        body = bodyJson
        try {
          JSON.parse(bodyJson || "{}")
        } catch {
          throw new Error("Body must be valid JSON for POST")
        }
      }
      const res = await fetch("/api/platform/pg-net", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          url,
          headers,
          body,
          timeout_ms: Number(timeoutMs) || 5000,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      toast.success(`Queued request #${data.request_id}`)
      // Give worker a moment then refresh
      setTimeout(() => void load(), 800)
      setTimeout(() => void load(), 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed")
    } finally {
      setSending(false)
    }
  }

  async function clearOld() {
    if (!confirm("Delete HTTP responses older than 24 hours?")) return
    const res = await fetch("/api/platform/pg-net", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", olderThanHours: 24 }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Clear failed")
      return
    }
    toast.success(`Deleted ${data.deleted} response(s)`)
    await load()
  }


  useStudioPage({
    title: "HTTP (pg_net)",
    subtitle: "Outbound HTTP from Postgres via net.http_get / http_post",
    toolbar: (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void clearOld()}
          disabled={!status?.installed}
        >
          <Trash2 className="size-3.5" />
          Clear old
        </Button>
      </div>
    ),
  })

  return (
    <>
      {status && !status.installed ? (
        <Alert>
          <Globe className="size-4" />
          <AlertTitle>pg_net not installed</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {status.available
                ? "Extension is available — enable it in this database to send HTTP from SQL."
                : "pg_net is not packaged on this Postgres instance. Install supabase/pg_net (or equivalent) first."}
            </p>
            {status.available ? (
              <Button size="sm" onClick={() => void enable()} disabled={enabling}>
                {enabling ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Enable pg_net
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Send request
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as "GET" | "POST" | "DELETE")
                }
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Headers (JSON)</Label>
              <Textarea
                value={headersJson}
                onChange={(e) => setHeadersJson(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            {method === "POST" ? (
              <div className="space-y-1.5">
                <Label>Body (JSON)</Label>
                <Textarea
                  value={bodyJson}
                  onChange={(e) => setBodyJson(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void send()}
              disabled={sending || !url.trim() || !status?.installed}
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Queue request
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Requests are async. Responses appear in{" "}
              <code>net._http_response</code> after the bg worker collects them.
            </p>
          </section>

          <div className="space-y-4">
            {queue.length > 0 ? (
              <section className="rounded-md border border-border">
                <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pending queue ({queue.length})
                </div>
                <ul className="max-h-36 overflow-auto text-xs">
                  {queue.map((q) => (
                    <li
                      key={q.id}
                      className="border-b border-border/40 px-3 py-1.5 font-mono"
                    >
                      #{q.id} {q.method} {q.url}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Responses ({responses.length})
              </div>
              {loading && !responses.length ? (
                <div className="flex items-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : responses.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No responses yet
                </p>
              ) : (
                <div className="grid gap-0 lg:grid-cols-2">
                  <div className="max-h-[420px] overflow-auto border-r border-border/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((r) => (
                          <tr
                            key={r.id}
                            className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${
                              selected?.id === r.id ? "bg-muted/50" : ""
                            }`}
                            onClick={() => setSelected(r)}
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              {r.id}
                            </td>
                            <td className="px-3 py-2">
                              {r.error_msg
                                ? "error"
                                : r.status_code ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                              {r.created
                                ? new Date(r.created).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="max-h-[420px] overflow-auto p-3 text-xs">
                    {selected ? (
                      <div className="space-y-2">
                        <div>
                          <span className="text-muted-foreground">Status:</span>{" "}
                          {selected.status_code ?? "—"}
                          {selected.timed_out ? " (timed out)" : ""}
                        </div>
                        {selected.error_msg ? (
                          <div className="text-destructive">
                            {selected.error_msg}
                          </div>
                        ) : null}
                        <div>
                          <div className="mb-1 text-muted-foreground">
                            Content-Type
                          </div>
                          <code>{selected.content_type || "—"}</code>
                        </div>
                        <div>
                          <div className="mb-1 text-muted-foreground">
                            Headers
                          </div>
                          <pre className="overflow-auto rounded bg-muted/40 p-2 font-mono">
                            {JSON.stringify(selected.headers, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-1 text-muted-foreground">Body</div>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono">
                            {selected.content || "—"}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Select a response to inspect
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  )
}
