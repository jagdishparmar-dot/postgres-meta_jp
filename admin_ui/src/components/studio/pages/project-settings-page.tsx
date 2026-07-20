"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import type { ProjectApiSettings } from "@/lib/platform/project-settings"

function SecretField({
  label,
  value,
  hint,
  revealable = true,
}: {
  label: string
  value: string
  hint?: string
  revealable?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 1500)
  }

  const display =
    revealable && !revealed
      ? value.length > 16
        ? `${value.slice(0, 8)}${"•".repeat(20)}${value.slice(-6)}`
        : "••••••••••••"
      : value

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        <Input
          readOnly
          value={display}
          className="font-mono text-xs"
        />
        {revealable ? (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" type="button" onClick={() => void copy()}>
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function ProjectSettingsPageClient() {
  const { project } = useProject()
  const { connection, ready } = useStudioConnection()
  const projectId = project?.id

  const [settings, setSettings] = useState<ProjectApiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiUrl, setApiUrl] = useState("")
  const [corsText, setCorsText] = useState("*")
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/settings`,
        { cache: "no-store" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load settings")
      setSettings(data.settings)
      setApiUrl(data.settings.api_url || "")
      setCorsText((data.settings.cors_allowed_origins || ["*"]).join("\n"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!projectId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_url: apiUrl.trim() || null,
          cors_allowed_origins: corsText,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setSettings(data.settings)
      toast.success("Settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function rotateKeys() {
    if (!projectId) return
    if (
      !confirm(
        "Rotate JWT secret and re-issue anon / service_role keys? Existing client keys will stop working."
      )
    ) {
      return
    }
    setRotating(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_keys" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Rotate failed")
      setSettings(data.settings)
      setApiUrl(data.settings.api_url || "")
      toast.success("API keys rotated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rotate failed")
    } finally {
      setRotating(false)
    }
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <StudioShell
      connection={connection}
      title="Project settings"
      subtitle="API URL, CORS, JWT secret, and anon / service_role keys"
      toolbar={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving || !settings}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </Button>
        </div>
      }
    >
      {loading || !settings ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          <Alert>
            <KeyRound className="size-4" />
            <AlertTitle>Supabase-style project credentials</AlertTitle>
            <AlertDescription className="text-xs">
              Keys are HS256 JWTs signed with this project&apos;s secret.{" "}
              <code>anon</code> is for public clients; <code>service_role</code>{" "}
              bypasses RLS in future API layers. Set{" "}
              <code>NEXT_PUBLIC_APP_URL</code> for absolute API URLs.
            </AlertDescription>
          </Alert>

          <section className="space-y-3 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium">Project</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input readOnly value={project?.name || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Ref (slug)</Label>
                <Input readOnly value={project?.slug || ""} className="font-mono" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Database</Label>
                <Input
                  readOnly
                  value={project?.database_name || ""}
                  className="font-mono"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium">API</h2>
            <div className="space-y-1.5">
              <Label htmlFor="api-url">Project API URL</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="font-mono text-xs"
                placeholder="/api/v1/&lt;project-id&gt;"
              />
              <p className="text-xs text-muted-foreground">
                Default is derived from <code>NEXT_PUBLIC_APP_URL</code>. Leave
                empty and save to reset to default on next ensure (or paste an
                absolute URL).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cors">CORS allowed origins</Label>
              <Textarea
                id="cors"
                value={corsText}
                onChange={(e) => setCorsText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder={"*\nor\nhttps://app.example.com"}
              />
              <p className="text-xs text-muted-foreground">
                One origin per line, or comma-separated. Use <code>*</code> for
                all origins.
              </p>
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">API keys</h2>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void rotateKeys()}
                disabled={rotating}
              >
                {rotating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Rotate keys
              </Button>
            </div>
            <SecretField
              label="anon key"
              value={settings.anon_key}
              hint="Public client key — role: anon"
            />
            <SecretField
              label="service_role key"
              value={settings.service_role_key}
              hint="Secret server key — role: service_role. Never expose in browsers."
            />
            <SecretField
              label="JWT secret"
              value={settings.jwt_secret}
              hint="Used to sign and verify project JWTs (HS256)"
            />
          </section>
        </div>
      )}
    </StudioShell>
  )
}
