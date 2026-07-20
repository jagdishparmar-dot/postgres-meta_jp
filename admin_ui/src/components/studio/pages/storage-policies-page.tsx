"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Shield, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { useProject } from "@/lib/platform/project-context"
import type { StorageBucket, StoragePolicy } from "@/lib/storage/schema"

const OPS = ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"] as const

export function StoragePoliciesPageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [policies, setPolicies] = useState<StoragePolicy[]>([])
  const [buckets, setBuckets] = useState<StorageBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [operation, setOperation] =
    useState<(typeof OPS)[number]>("SELECT")
  const [bucketId, setBucketId] = useState("")
  const [definition, setDefinition] = useState("allow")
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [pRes, bRes] = await Promise.all([
        fetch(`/api/platform/projects/${projectId}/storage/policies`),
        fetch(`/api/platform/projects/${projectId}/storage/buckets`),
      ])
      const pData = await pRes.json()
      const bData = await bRes.json()
      if (!pRes.ok) throw new Error(pData.error || "Failed to load policies")
      setPolicies(pData.policies || [])
      setBuckets(bData.buckets || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    if (!projectId || !name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/policies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            operation,
            bucket_id: bucketId || null,
            definition,
            enabled,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      toast.success("Policy created")
      setOpen(false)
      setName("")
      setDefinition("allow")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggle(policy: StoragePolicy) {
    if (!projectId) return
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/policies`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: policy.id, enabled: !policy.enabled }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Update failed")
      return
    }
    await load()
  }

  async function remove(policy: StoragePolicy) {
    if (!projectId) return
    if (!confirm(`Delete policy “${policy.name}”?`)) return
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/policies?policyId=${policy.id}`,
      { method: "DELETE" }
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Delete failed")
      return
    }
    toast.success("Policy deleted")
    await load()
  }

  return (
    <StorageShell
      title="Storage policies"
      subtitle="RLS-style rules enforced by the Storage API (deny definitions block operations)"
      toolbar={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          New policy
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Put <code>deny</code>, <code>false</code>, or <code>block</code> in the
        definition to deny the operation. Use <code>allow</code> (or any other
        text) to document an allow rule. Scope to one bucket or leave empty for
        all buckets.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
          <Shield className="size-8 opacity-40" />
          No policies yet
        </div>
      ) : (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Bucket</th>
                <th className="px-3 py-2">Definition</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.operation}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.bucket_name || "All"}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 font-mono text-xs">
                    {p.definition}
                  </td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={p.enabled}
                      onCheckedChange={() => void toggle(p)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(p)}
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
            <DialogTitle>Create policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Operation</Label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={operation}
                onChange={(e) =>
                  setOperation(e.target.value as (typeof OPS)[number])
                }
              >
                {OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Bucket (optional)</Label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={bucketId}
                onChange={(e) => setBucketId(e.target.value)}
              >
                <option value="">All buckets</option>
                {buckets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Definition</Label>
              <Textarea
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                rows={3}
                placeholder="allow — or deny to block"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={enabled}
                onCheckedChange={(v) => setEnabled(Boolean(v))}
              />
              Enabled
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorageShell>
  )
}
