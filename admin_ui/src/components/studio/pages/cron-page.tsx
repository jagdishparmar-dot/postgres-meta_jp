"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import type { CronJob, CronJobRun } from "@/lib/pg-cron"

type Status = { installed: boolean; available: boolean; error?: string }

const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily midnight", value: "0 0 * * *" },
  { label: "Weekly Sun", value: "0 0 * * 0" },
  { label: "Weekdays 9am", value: "0 9 * * 1-5" },
]

export function CronPageClient() {
  const { connection, ready } = useStudioConnection()
  const [status, setStatus] = useState<Status | null>(null)
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [runs, setRuns] = useState<CronJobRun[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [schedule, setSchedule] = useState("0 * * * *")
  const [command, setCommand] = useState("SELECT 1")
  const [saving, setSaving] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [enabling, setEnabling] = useState(false)

  const load = useCallback(async (jobid?: number | null) => {
    setLoading(true)
    try {
      const qs =
        jobid != null ? `?jobid=${jobid}&limit=50` : "?limit=50"
      const res = await fetch(`/api/platform/cron${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load cron")
      setStatus(data.status)
      setJobs(data.jobs || [])
      setRuns(data.runs || [])
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
      const res = await fetch("/api/platform/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Enable failed")
      toast.success("pg_cron enabled")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enable failed")
    } finally {
      setEnabling(false)
    }
  }

  async function createJob() {
    setSaving(true)
    try {
      const res = await fetch("/api/platform/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          schedule,
          command,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Schedule failed")
      toast.success(`Job #${data.jobid} scheduled`)
      setOpen(false)
      setName("")
      setCommand("SELECT 1")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Schedule failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(job: CronJob) {
    const res = await fetch("/api/platform/cron", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobid: job.jobid, active: !job.active }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Update failed")
      return
    }
    toast.success(job.active ? "Job paused" : "Job activated")
    await load(selectedJobId)
  }

  async function removeJob(job: CronJob) {
    if (!confirm(`Unschedule job #${job.jobid}${job.jobname ? ` (${job.jobname})` : ""}?`)) {
      return
    }
    const res = await fetch(`/api/platform/cron?jobid=${job.jobid}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Unschedule failed")
      return
    }
    toast.success("Job unscheduled")
    if (selectedJobId === job.jobid) setSelectedJobId(null)
    await load()
  }

  async function runNow(job: CronJob) {
    const res = await fetch("/api/platform/cron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", jobid: job.jobid }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Run failed")
      return
    }
    if (data.ok) toast.success("Command ran successfully")
    else toast.error(data.message || "Command failed")
    await load(job.jobid)
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
      title="Cron"
      subtitle="pg_cron — schedule SQL jobs inside Postgres"
      toolbar={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load(selectedJobId)}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!status?.installed}
          >
            <Plus className="size-3.5" />
            New job
          </Button>
        </div>
      }
    >
      {status && !status.installed ? (
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>pg_cron not installed</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {status.available
                ? "The extension is available on this server but not enabled in the current database."
                : "pg_cron is not in pg_available_extensions. Install the package and add shared_preload_libraries='pg_cron', then restart Postgres."}
            </p>
            {status.available ? (
              <Button size="sm" onClick={() => void enable()} disabled={enabling}>
                {enabling ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Enable pg_cron
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : loading && !jobs.length ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Jobs ({jobs.length})
            </div>
            {jobs.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No scheduled jobs
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Schedule</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr
                        key={job.jobid}
                        className={`border-b border-border/60 hover:bg-muted/40 ${
                          selectedJobId === job.jobid ? "bg-muted/50" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={() => {
                              setSelectedJobId(job.jobid)
                              void load(job.jobid)
                            }}
                          >
                            {job.jobid}
                          </button>
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2">
                          {job.jobname || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {job.schedule}
                        </td>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={job.active}
                            onCheckedChange={() => void toggleActive(job)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Run now"
                              onClick={() => void runNow(job)}
                            >
                              <Play className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title={job.active ? "Pause" : "Activate"}
                              onClick={() => void toggleActive(job)}
                            >
                              {job.active ? (
                                <Pause className="size-3.5" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Unschedule"
                              onClick={() => void removeJob(job)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedJobId != null ? (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">
                  Command (job #{selectedJobId})
                </div>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono">
                  {jobs.find((j) => j.jobid === selectedJobId)?.command || "—"}
                </pre>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent runs
              {selectedJobId != null ? ` · job #${selectedJobId}` : ""}
            </div>
            {runs.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No run history
              </p>
            ) : (
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.runid} className="border-b border-border/60">
                        <td className="px-3 py-2 font-mono text-xs">{r.jobid}</td>
                        <td className="px-3 py-2">{r.status || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                          {r.start_time
                            ? new Date(r.start_time).toLocaleString()
                            : "—"}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-xs">
                          {r.return_message || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule cron job</DialogTitle>
            <DialogDescription>
              Standard 5-field cron expression. Command runs as SQL in this
              database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name (optional)</Label>
              <Input
                placeholder="nightly-vacuum"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Schedule</Label>
              <Input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant={schedule === p.value ? "default" : "outline"}
                    onClick={() => setSchedule(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>SQL command</Label>
              <Textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createJob()}
              disabled={saving || !schedule.trim() || !command.trim()}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioShell>
  )
}
