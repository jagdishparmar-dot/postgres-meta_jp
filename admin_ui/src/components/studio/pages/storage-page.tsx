"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Link2,
  Loader2,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Upload,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import type { StorageBucket, StorageObject } from "@/lib/storage/schema"

type BrowseFolder = { name: string; prefix: string }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean)
  return parts[parts.length - 1] || path
}

function isImage(mime: string | null | undefined, name: string): boolean {
  if (mime?.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)
}

function isPdf(mime: string | null | undefined, name: string): boolean {
  if (mime === "application/pdf") return true
  return /\.pdf$/i.test(name)
}

function canPreview(obj: StorageObject): boolean {
  return isImage(obj.mime_type, obj.name) || isPdf(obj.mime_type, obj.name)
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(xhr.responseText || "{}")
      } catch {
        data = {}
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
    }
    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(form)
  })
}

export function StoragePageClient() {
  const { project } = useProject()
  const { connection, ready } = useStudioConnection()
  const projectId = project?.id

  const [status, setStatus] = useState<{ configured: boolean } | null>(null)
  const [buckets, setBuckets] = useState<StorageBucket[]>([])
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null)
  const [prefix, setPrefix] = useState("")
  const [folders, setFolders] = useState<BrowseFolder[]>([])
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [loadingObjects, setLoadingObjects] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPublic, setNewPublic] = useState(false)
  const [creating, setCreating] = useState(false)

  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPublic, setSettingsPublic] = useState(false)
  const [settingsLimitMb, setSettingsLimitMb] = useState("")
  const [settingsMimes, setSettingsMimes] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadLabel, setUploadLabel] = useState("")
  const [importingZip, setImportingZip] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)

  const [previewObj, setPreviewObj] = useState<StorageObject | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [urlObj, setUrlObj] = useState<StorageObject | null>(null)
  const [urlExpires, setUrlExpires] = useState("3600")
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  const [pathObj, setPathObj] = useState<StorageObject | null>(null)
  const [pathAction, setPathAction] = useState<"rename" | "move" | "copy">(
    "rename"
  )
  const [pathValue, setPathValue] = useState("")
  const [pathSaving, setPathSaving] = useState(false)

  const selectedBucket = useMemo(
    () => buckets.find((b) => b.id === selectedBucketId) ?? null,
    [buckets, selectedBucketId]
  )

  const crumbs = useMemo(() => {
    if (!prefix) return [] as { label: string; prefix: string }[]
    const parts = prefix.replace(/\/$/, "").split("/").filter(Boolean)
    const out: { label: string; prefix: string }[] = []
    let acc = ""
    for (const part of parts) {
      acc += `${part}/`
      out.push({ label: part, prefix: acc })
    }
    return out
  }, [prefix])

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/platform/storage/status")
    const data = await res.json()
    setStatus({ configured: Boolean(data.configured) })
  }, [])

  const loadBuckets = useCallback(async () => {
    if (!projectId) return
    setLoadingBuckets(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to list buckets")
      setBuckets(data.buckets || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list buckets")
    } finally {
      setLoadingBuckets(false)
    }
  }, [projectId])

  const loadBrowse = useCallback(
    async (bucketId: string, nextPrefix: string) => {
      if (!projectId) return
      setLoadingObjects(true)
      try {
        const qs = nextPrefix
          ? `?prefix=${encodeURIComponent(nextPrefix)}`
          : ""
        const res = await fetch(
          `/api/platform/projects/${projectId}/storage/buckets/${bucketId}/objects${qs}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to list objects")
        setFolders(data.folders || [])
        setObjects(data.objects || [])
        setPrefix(data.prefix || "")
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to list objects"
        )
      } finally {
        setLoadingObjects(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (status?.configured && projectId) void loadBuckets()
  }, [status?.configured, projectId, loadBuckets])

  useEffect(() => {
    if (selectedBucketId) {
      setPrefix("")
      void loadBrowse(selectedBucketId, "")
    } else {
      setFolders([])
      setObjects([])
      setPrefix("")
    }
  }, [selectedBucketId, loadBrowse])

  async function createBucket() {
    if (!projectId || !newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, public: newPublic }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      toast.success(`Bucket “${data.bucket.name}” created`)
      setCreateOpen(false)
      setNewName("")
      setNewPublic(false)
      await loadBuckets()
      setSelectedBucketId(data.bucket.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  async function removeBucket(bucket: StorageBucket) {
    if (!projectId) return
    if (
      !confirm(
        `Delete bucket “${bucket.name}” and all objects? This cannot be undone.`
      )
    ) {
      return
    }
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets/${bucket.id}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast.success("Bucket deleted")
      if (selectedBucketId === bucket.id) setSelectedBucketId(null)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  function openSettings() {
    if (!selectedBucket) return
    setSettingsPublic(selectedBucket.public)
    setSettingsLimitMb(
      selectedBucket.file_size_limit != null
        ? String(Math.round(selectedBucket.file_size_limit / (1024 * 1024)))
        : ""
    )
    setSettingsMimes((selectedBucket.allowed_mime_types || []).join(", "))
    setSettingsOpen(true)
  }

  async function saveSettings() {
    if (!projectId || !selectedBucketId) return
    setSavingSettings(true)
    try {
      const limitMb = settingsLimitMb.trim()
      const mimes = settingsMimes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets/${selectedBucketId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public: settingsPublic,
            file_size_limit: limitMb
              ? Math.round(Number(limitMb) * 1024 * 1024)
              : null,
            allowed_mime_types: mimes.length ? mimes : null,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      toast.success("Bucket settings saved")
      setSettingsOpen(false)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSavingSettings(false)
    }
  }

  async function createFolder() {
    if (!projectId || !selectedBucketId || !folderName.trim()) return
    setCreatingFolder(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets/${selectedBucketId}/folders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName, prefix }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create folder failed")
      toast.success("Folder created")
      setFolderOpen(false)
      setFolderName("")
      await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create folder failed")
    } finally {
      setCreatingFolder(false)
    }
  }

  async function deleteFolder(folder: BrowseFolder) {
    if (!projectId || !selectedBucketId) return
    if (
      !confirm(
        `Delete folder “${folder.name}” and all files inside? This cannot be undone.`
      )
    ) {
      return
    }
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/buckets/${selectedBucketId}/delete-prefix`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: folder.prefix }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast.success(`Deleted ${data.deleted ?? 0} object(s)`)
      await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function onUpload(files: FileList | null) {
    if (!projectId || !selectedBucketId || !files?.length) return
    setUploading(true)
    setUploadPct(0)
    try {
      const list = Array.from(files)
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        setUploadLabel(`${file.name} (${i + 1}/${list.length})`)
        setUploadPct(0)
        const form = new FormData()
        form.set("file", file)
        form.set("path", file.name)
        form.set("prefix", prefix)
        form.set("contentType", file.type || "application/octet-stream")
        const result = await uploadWithProgress(
          `/api/platform/projects/${projectId}/storage/buckets/${selectedBucketId}/objects`,
          form,
          setUploadPct
        )
        if (!result.ok) {
          throw new Error(
            (result.data.error as string) || `Upload failed: ${file.name}`
          )
        }
      }
      toast.success(
        list.length === 1 ? "File uploaded" : `${list.length} files uploaded`
      )
      await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setUploadPct(0)
      setUploadLabel("")
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function onZipImport(files: FileList | null) {
    if (!projectId || !selectedBucketId || !files?.[0]) return
    setImportingZip(true)
    try {
      const form = new FormData()
      form.set("file", files[0])
      form.set("bucketId", selectedBucketId)
      form.set("prefix", prefix)
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/zip`,
        { method: "POST", body: form }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Zip import failed")
      toast.success(
        `Imported ${data.imported} file(s)` +
          (data.errors?.length ? ` · ${data.errors.length} error(s)` : "")
      )
      if (data.errors?.length) {
        console.warn("Zip import errors", data.errors)
      }
      await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zip import failed")
    } finally {
      setImportingZip(false)
      if (zipRef.current) zipRef.current.value = ""
    }
  }

  async function removeObject(obj: StorageObject) {
    if (!projectId) return
    if (!confirm(`Delete “${basename(obj.name)}”?`)) return
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/objects/${obj.id}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast.success("Object deleted")
      if (selectedBucketId) await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function fetchSignedUrl(obj: StorageObject, expiresIn: number) {
    if (!projectId) throw new Error("No project")
    const res = await fetch(
      `/api/platform/projects/${projectId}/storage/objects/${obj.id}/url?expiresIn=${expiresIn}`
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "URL failed")
    return data as {
      url: string
      publicUrl: string | null
      expiresIn: number
    }
  }

  async function openPreview(obj: StorageObject) {
    setPreviewObj(obj)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      const data = await fetchSignedUrl(obj, 3600)
      setPreviewUrl(data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed")
      setPreviewObj(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function openUrlDialog(obj: StorageObject) {
    setUrlObj(obj)
    setSignedUrl(null)
    setPublicUrl(null)
    setUrlExpires("3600")
    setUrlLoading(true)
    try {
      const data = await fetchSignedUrl(obj, 3600)
      setSignedUrl(data.url)
      const pub = data.publicUrl
      setPublicUrl(
        pub && pub.startsWith("/")
          ? `${window.location.origin}${pub}`
          : pub
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL failed")
      setUrlObj(null)
    } finally {
      setUrlLoading(false)
    }
  }

  async function refreshSignedUrl() {
    if (!urlObj) return
    setUrlLoading(true)
    try {
      const expiresIn = Number(urlExpires) || 3600
      const data = await fetchSignedUrl(urlObj, expiresIn)
      setSignedUrl(data.url)
      const pub = data.publicUrl
      setPublicUrl(
        pub && pub.startsWith("/")
          ? `${window.location.origin}${pub}`
          : pub
      )
      toast.success("Signed URL refreshed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL failed")
    } finally {
      setUrlLoading(false)
    }
  }

  function openPathDialog(
    obj: StorageObject,
    action: "rename" | "move" | "copy"
  ) {
    setPathObj(obj)
    setPathAction(action)
    if (action === "rename") {
      setPathValue(basename(obj.name))
    } else if (action === "copy") {
      const base = basename(obj.name)
      const dir = obj.name.includes("/")
        ? obj.name.slice(0, obj.name.lastIndexOf("/") + 1)
        : ""
      setPathValue(`${dir}copy-of-${base}`)
    } else {
      setPathValue(obj.name)
    }
  }

  async function savePathAction() {
    if (!projectId || !pathObj || !pathValue.trim()) return
    setPathSaving(true)
    try {
      let toPath = pathValue.trim().replace(/^\/+/, "")
      if (pathAction === "rename") {
        const dir = pathObj.name.includes("/")
          ? pathObj.name.slice(0, pathObj.name.lastIndexOf("/") + 1)
          : ""
        toPath = `${dir}${basename(toPath)}`
      }
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/objects/${pathObj.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: pathAction === "rename" ? "move" : pathAction,
            toPath,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Operation failed")
      toast.success(
        pathAction === "copy"
          ? "Object copied"
          : pathAction === "rename"
            ? "Object renamed"
            : "Object moved"
      )
      setPathObj(null)
      if (selectedBucketId) await loadBrowse(selectedBucketId, prefix)
      await loadBuckets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed")
    } finally {
      setPathSaving(false)
    }
  }

  async function downloadObject(obj: StorageObject) {
    try {
      const data = await fetchSignedUrl(obj, 3600)
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed")
    }
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  const empty =
    !loadingObjects && folders.length === 0 && objects.length === 0

  return (
    <StudioShell
      connection={connection}
      title="Storage"
      subtitle="Buckets and objects · metadata in project DB · files in RustFS"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={!status?.configured}
          >
            <Plus className="size-3.5" />
            New bucket
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedBucketId || !status?.configured}
            onClick={() => setFolderOpen(true)}
          >
            <FolderPlus className="size-3.5" />
            New folder
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedBucketId || !status?.configured || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              !selectedBucketId || !status?.configured || importingZip
            }
            onClick={() => zipRef.current?.click()}
          >
            {importingZip ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileArchive className="size-3.5" />
            )}
            Import zip
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedBucket}
            onClick={openSettings}
          >
            <Settings2 className="size-3.5" />
            Settings
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
          <input
            ref={zipRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => void onZipImport(e.target.files)}
          />
        </div>
      }
    >
      {status && !status.configured ? (
        <Alert>
          <HardDrive className="size-4" />
          <AlertTitle>RustFS not configured</AlertTitle>
          <AlertDescription>
            Set <code className="text-xs">RUSTFS_ENDPOINT</code>,{" "}
            <code className="text-xs">RUSTFS_ACCESS_KEY</code>, and{" "}
            <code className="text-xs">RUSTFS_SECRET_KEY</code> in{" "}
            <code className="text-xs">.env.local</code>, then restart the admin
            UI.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {uploading ? (
            <div className="rounded-md border border-border bg-card/40 px-3 py-2">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Uploading {uploadLabel}</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Large files use multipart upload on the server after transfer.
              </p>
            </div>
          ) : null}

          <div className="grid min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-md border border-border bg-card/40">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Buckets
                </span>
                {loadingBuckets ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              <ul className="max-h-[560px] overflow-auto p-1">
                {buckets.length === 0 && !loadingBuckets ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No buckets yet
                  </li>
                ) : (
                  buckets.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBucketId(b.id)}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
                          selectedBucketId === b.id ? "bg-muted" : ""
                        }`}
                      >
                        <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {b.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {b.object_count ?? 0}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </aside>

            <section className="rounded-md border border-border bg-card/40">
              {!selectedBucket ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                  <HardDrive className="size-8 opacity-40" />
                  Select a bucket or create one to manage objects.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {selectedBucket.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedBucket.public ? "Public" : "Private"}
                        {selectedBucket.file_size_limit != null
                          ? ` · max ${formatBytes(selectedBucket.file_size_limit)}`
                          : ""}
                        {selectedBucket.allowed_mime_types?.length
                          ? ` · ${selectedBucket.allowed_mime_types.length} MIME rule(s)`
                          : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-0.5 text-xs">
                        <button
                          type="button"
                          className="rounded px-1 py-0.5 text-primary hover:bg-muted"
                          onClick={() =>
                            selectedBucketId &&
                            void loadBrowse(selectedBucketId, "")
                          }
                        >
                          /
                        </button>
                        {crumbs.map((c) => (
                          <span key={c.prefix} className="flex items-center">
                            <ChevronRight className="size-3 text-muted-foreground" />
                            <button
                              type="button"
                              className="rounded px-1 py-0.5 hover:bg-muted"
                              onClick={() =>
                                selectedBucketId &&
                                void loadBrowse(selectedBucketId, c.prefix)
                              }
                            >
                              {c.label}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void removeBucket(selectedBucket)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete bucket
                    </Button>
                  </div>

                  {loadingObjects ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading…
                    </div>
                  ) : empty ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Empty — upload files or create a folder.
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 font-medium">Size</th>
                            <th className="px-3 py-2 font-medium">Updated</th>
                            <th className="px-3 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {folders.map((folder) => (
                            <tr
                              key={folder.prefix}
                              className="border-b border-border/60 hover:bg-muted/40"
                            >
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 font-medium hover:underline"
                                  onClick={() =>
                                    selectedBucketId &&
                                    void loadBrowse(
                                      selectedBucketId,
                                      folder.prefix
                                    )
                                  }
                                >
                                  <Folder className="size-3.5 text-muted-foreground" />
                                  {folder.name}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                Folder
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                —
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                —
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          aria-label={`Actions for ${folder.name}`}
                                        />
                                      }
                                    >
                                      <MoreHorizontal className="size-3.5" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="min-w-40"
                                    >
                                      <DropdownMenuItem
                                        onClick={() =>
                                          selectedBucketId &&
                                          void loadBrowse(
                                            selectedBucketId,
                                            folder.prefix
                                          )
                                        }
                                      >
                                        <FolderOpen className="size-3.5" />
                                        Open
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => void deleteFolder(folder)}
                                      >
                                        <Trash2 className="size-3.5" />
                                        Delete folder
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {objects.map((obj) => (
                            <tr
                              key={obj.id}
                              className="border-b border-border/60 hover:bg-muted/40"
                            >
                              <td className="max-w-[280px] truncate px-3 py-2 font-medium">
                                <span className="inline-flex items-center gap-2">
                                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                  {basename(obj.name)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {obj.mime_type || "—"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatBytes(obj.size)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {new Date(obj.updated_at).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          aria-label={`Actions for ${basename(obj.name)}`}
                                        />
                                      }
                                    >
                                      <MoreHorizontal className="size-3.5" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="min-w-44"
                                    >
                                      {canPreview(obj) ? (
                                        <DropdownMenuItem
                                          onClick={() => void openPreview(obj)}
                                        >
                                          <Eye className="size-3.5" />
                                          Preview
                                        </DropdownMenuItem>
                                      ) : null}
                                      <DropdownMenuItem
                                        onClick={() => void downloadObject(obj)}
                                      >
                                        <Download className="size-3.5" />
                                        Download
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => void openUrlDialog(obj)}
                                      >
                                        <Link2 className="size-3.5" />
                                        Signed URL
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openPathDialog(obj, "rename")
                                        }
                                      >
                                        <Pencil className="size-3.5" />
                                        Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openPathDialog(obj, "move")
                                        }
                                      >
                                        <MoveRight className="size-3.5" />
                                        Move
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openPathDialog(obj, "copy")
                                        }
                                      >
                                        <Copy className="size-3.5" />
                                        Copy
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => void removeObject(obj)}
                                      >
                                        <Trash2 className="size-3.5" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Create bucket */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create bucket</DialogTitle>
            <DialogDescription>
              Logical bucket in this project DB. Bytes go to the project RustFS
              bucket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="bucket-name">Name</Label>
              <Input
                id="bucket-name"
                placeholder="avatars"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newPublic}
                onCheckedChange={(v) => setNewPublic(Boolean(v))}
              />
              Public bucket
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createBucket()}
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Created under{" "}
              <code className="text-xs">/{prefix || ""}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              placeholder="images"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createFolder()}
              disabled={creatingFolder || !folderName.trim()}
            >
              {creatingFolder ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FolderPlus className="size-3.5" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bucket settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bucket settings</DialogTitle>
            <DialogDescription>
              {selectedBucket?.name} — access and upload constraints
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settingsPublic}
                onCheckedChange={(v) => setSettingsPublic(Boolean(v))}
              />
              Public bucket
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="size-limit">File size limit (MB)</Label>
              <Input
                id="size-limit"
                type="number"
                min={0}
                placeholder="No limit"
                value={settingsLimitMb}
                onChange={(e) => setSettingsLimitMb(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mimes">Allowed MIME types</Label>
              <Textarea
                id="mimes"
                placeholder="image/*, application/pdf"
                value={settingsMimes}
                onChange={(e) => setSettingsMimes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Use <code>image/*</code> wildcards. Empty =
                allow all.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveSettings()}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog
        open={Boolean(previewObj)}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewObj(null)
            setPreviewUrl(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewObj ? basename(previewObj.name) : "Preview"}</DialogTitle>
            <DialogDescription>
              {previewObj?.mime_type || "file"} ·{" "}
              {previewObj ? formatBytes(previewObj.size) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[240px] items-center justify-center overflow-auto rounded-md border border-border bg-muted/30 p-2">
            {previewLoading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : previewUrl && previewObj && isImage(previewObj.mime_type, previewObj.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewObj.name}
                className="max-h-[60vh] max-w-full object-contain"
              />
            ) : previewUrl && previewObj && isPdf(previewObj.mime_type, previewObj.name) ? (
              <iframe
                title={previewObj.name}
                src={previewUrl}
                className="h-[60vh] w-full rounded-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Preview unavailable</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewObj && void downloadObject(previewObj)}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signed URL */}
      <Dialog
        open={Boolean(urlObj)}
        onOpenChange={(o) => {
          if (!o) {
            setUrlObj(null)
            setSignedUrl(null)
            setPublicUrl(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signed URL</DialogTitle>
            <DialogDescription>
              {urlObj ? basename(urlObj.name) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="expires">Expires in (seconds)</Label>
              <div className="flex gap-2">
                <Input
                  id="expires"
                  type="number"
                  min={60}
                  max={604800}
                  value={urlExpires}
                  onChange={(e) => setUrlExpires(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => void refreshSignedUrl()}
                  disabled={urlLoading}
                >
                  {urlLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Refresh
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {[
                  { label: "1h", v: "3600" },
                  { label: "24h", v: "86400" },
                  { label: "7d", v: "604800" },
                ].map((opt) => (
                  <Button
                    key={opt.v}
                    size="sm"
                    variant={urlExpires === opt.v ? "default" : "outline"}
                    onClick={() => setUrlExpires(opt.v)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Download URL</Label>
              <Textarea
                readOnly
                value={signedUrl || (urlLoading ? "Loading…" : "")}
                rows={3}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!signedUrl}
                onClick={() => {
                  if (!signedUrl) return
                  void copyText(signedUrl).then(() =>
                    toast.success("URL copied")
                  )
                }}
              >
                <Copy className="size-3.5" />
                Copy signed URL
              </Button>
            </div>
            {publicUrl ? (
              <div className="space-y-1.5">
                <Label>Public URL</Label>
                <Textarea
                  readOnly
                  value={publicUrl}
                  rows={2}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void copyText(publicUrl).then(() =>
                      toast.success("Public URL copied")
                    )
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy public URL
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Move / rename / copy */}
      <Dialog
        open={Boolean(pathObj)}
        onOpenChange={(o) => {
          if (!o) setPathObj(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pathAction === "copy"
                ? "Copy object"
                : pathAction === "rename"
                  ? "Rename object"
                  : "Move object"}
            </DialogTitle>
            <DialogDescription>
              {pathObj ? pathObj.name : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="to-path">
              {pathAction === "rename" ? "New name" : "Destination path"}
            </Label>
            <Input
              id="to-path"
              value={pathValue}
              onChange={(e) => setPathValue(e.target.value)}
              autoFocus
            />
            {pathAction !== "rename" ? (
              <p className="text-xs text-muted-foreground">
                Use paths like <code>folder/file.png</code>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPathObj(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void savePathAction()}
              disabled={pathSaving || !pathValue.trim()}
            >
              {pathSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {pathAction === "copy"
                ? "Copy"
                : pathAction === "rename"
                  ? "Rename"
                  : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioShell>
  )
}
