"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import {
  formatBytes,
  StorageShell,
} from "@/components/studio/pages/storage-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProject } from "@/lib/platform/project-context"

type Settings = {
  physical_bucket: string | null
  quota_bytes: number | null
  scan_webhook_url: string | null
  scan_webhook_from_env: boolean
  public_url_base: string | null
}

export function StorageSecurityPageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quotaMb, setQuotaMb] = useState("")
  const [webhook, setWebhook] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/settings`
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to load settings")
      return
    }
    setSettings(data.settings)
    setQuotaMb(
      data.settings.quota_bytes != null
        ? String(Math.round(data.settings.quota_bytes / (1024 * 1024)))
        : ""
    )
    setWebhook(data.settings.scan_webhook_url || "")
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!projectId) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quota_bytes: quotaMb.trim()
              ? Math.round(Number(quotaMb) * 1024 * 1024)
              : null,
            scan_webhook_url: webhook.trim() || null,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setSettings(data.settings)
      toast.success("Security settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <StorageShell
      title="Storage security"
      subtitle="Public URLs, content scanning, and project quota"
      toolbar={
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Save
        </Button>
      }
    >
      {!settings ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="mx-auto max-w-xl space-y-6">
          <Alert>
            <AlertTitle>Public object URLs</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>
                For public buckets, objects are available at the API proxy:
              </p>
              <code className="block break-all rounded bg-muted px-2 py-1">
                /api/platform/projects/{projectId}/storage/public/&lt;bucket&gt;/&lt;path&gt;
              </code>
              {settings.public_url_base ? (
                <p>
                  Direct RustFS public base:{" "}
                  <code>{settings.public_url_base}</code>
                </p>
              ) : (
                <p>
                  Set <code>RUSTFS_PUBLIC_URL</code> for direct CDN-style links
                  (optional; proxy always works).
                </p>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label>Project quota (MB)</Label>
            <Input
              type="number"
              min={0}
              placeholder="No quota"
              value={quotaMb}
              onChange={(e) => setQuotaMb(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Current setting:{" "}
              {settings.quota_bytes != null
                ? formatBytes(settings.quota_bytes)
                : "unlimited"}
              . Enforced on upload.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Content scan webhook URL</Label>
            <Input
              placeholder="https://scanner.example/hook"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              disabled={settings.scan_webhook_from_env}
            />
            <p className="text-xs text-muted-foreground">
              POST JSON with object metadata; respond{" "}
              <code>{`{ "ok": true }`}</code> or{" "}
              <code>{`{ "ok": false, "reason": "..." }`}</code>. Rejected
              uploads are removed. Scanner errors quarantine the object.
              {settings.scan_webhook_from_env
                ? " Locked by STORAGE_SCAN_WEBHOOK_URL env."
                : " Or set STORAGE_SCAN_WEBHOOK_URL in env."}
            </p>
          </div>

          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            Physical RustFS bucket:{" "}
            <code>{settings.physical_bucket || "—"}</code>
          </div>
        </div>
      )}
    </StorageShell>
  )
}
