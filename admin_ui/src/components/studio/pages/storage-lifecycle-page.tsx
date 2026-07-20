"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { StorageShell } from "@/components/studio/pages/storage-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProject } from "@/lib/platform/project-context"
import type { StorageBucket, StorageLifecycleRule } from "@/lib/storage/schema"

export function StorageLifecyclePageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [rules, setRules] = useState<StorageLifecycleRule[]>([])
  const [buckets, setBuckets] = useState<StorageBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [bucketId, setBucketId] = useState("")
  const [days, setDays] = useState("30")
  const [prefix, setPrefix] = useState("")
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [rRes, bRes] = await Promise.all([
        fetch(`/api/platform/projects/${projectId}/storage/lifecycle`),
        fetch(`/api/platform/projects/${projectId}/storage/buckets`),
      ])
      const rData = await rRes.json()
      const bData = await bRes.json()
      if (!rRes.ok) throw new Error(rData.error || "Failed to load rules")
      setRules(rData.rules || [])
      setBuckets(bData.buckets || [])
      if (!bucketId && bData.buckets?.[0]) setBucketId(bData.buckets[0].id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId, bucketId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function create() {
    if (!projectId || !name.trim() || !bucketId) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            bucket_id: bucketId,
            days: Number(days),
            prefix,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      toast.success("Rule created")
      setOpen(false)
      setName("")
      setPrefix("")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggle(rule: StorageLifecycleRule) {
    if (!projectId) return
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/lifecycle`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Update failed")
      return
    }
    await load()
  }

  async function remove(rule: StorageLifecycleRule) {
    if (!projectId) return
    if (!confirm(`Delete rule “${rule.name}”?`)) return
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/lifecycle?ruleId=${rule.id}`,
      { method: "DELETE" }
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Delete failed")
      return
    }
    toast.success("Rule deleted")
    await load()
  }

  async function applyAll() {
    if (!projectId) return
    if (
      !confirm(
        "Apply enabled lifecycle rules now? Matching objects will be permanently deleted."
      )
    ) {
      return
    }
    setApplying(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apply: true }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Apply failed")
      toast.success(
        `Applied ${data.rules_applied} rule(s); deleted ${data.deleted} object(s)`
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  return (
    <StorageShell
      title="Lifecycle rules"
      subtitle="Expire objects older than N days (run manually or via cron hitting Apply)"
      toolbar={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void applyAll()}
            disabled={applying}
          >
            {applying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Apply now
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            New rule
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rules.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No lifecycle rules
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Bucket</th>
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Days</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.bucket_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.prefix || "/"}
                  </td>
                  <td className="px-3 py-2">{r.days}</td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={r.enabled}
                      onCheckedChange={() => void toggle(r)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(r)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New lifecycle rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bucket</Label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={bucketId}
                onChange={(e) => setBucketId(e.target.value)}
              >
                {buckets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Expire after (days)</Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prefix (optional)</Label>
              <Input
                placeholder="tmp/"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void create()}
              disabled={saving || !name.trim() || !bucketId}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorageShell>
  )
}
