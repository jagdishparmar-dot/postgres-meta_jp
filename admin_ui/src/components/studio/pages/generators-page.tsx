"use client"

import { useState } from "react"
import { Copy, Download, FileCode2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { fetchMeta } from "@/lib/client-meta"

type Lang = "typescript" | "python" | "go" | "swift"

const LANGS: { id: Lang; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "swift", label: "Swift" },
]

export function GeneratorsPageClient() {
  const { connection, ready } = useStudioConnection()
  const [lang, setLang] = useState<Lang>("typescript")
  const [included, setIncluded] = useState("public")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (included.trim()) {
        params.set("included_schemas", included.trim())
      }
      const qs = params.toString()
      const path = `generators/${lang}${qs ? `?${qs}` : ""}`
      const data = await fetchMeta<string | { types?: string }>(path)
      const text =
        typeof data === "string"
          ? data
          : typeof data === "object" && data && "types" in data
            ? String((data as { types: string }).types)
            : JSON.stringify(data, null, 2)
      setOutput(text)
      toast.success(`Generated ${lang} types`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed")
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!output) return
    void navigator.clipboard.writeText(output)
    toast.success("Copied to clipboard")
  }

  function download() {
    if (!output) return
    const ext =
      lang === "typescript"
        ? "ts"
        : lang === "python"
          ? "py"
          : lang === "go"
            ? "go"
            : "swift"
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `database.${ext}`
    a.click()
    URL.revokeObjectURL(url)
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
      title="Type generators"
      subtitle="Generate client types from the project schema"
      toolbar={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {LANGS.map((l) => (
                <Button
                  key={l.id}
                  size="sm"
                  variant={lang === l.id ? "default" : "ghost"}
                  onClick={() => setLang(l.id)}
                >
                  {l.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Schemas</Label>
              <Input
                value={included}
                onChange={(e) => setIncluded(e.target.value)}
                placeholder="public,app"
                className="h-8 w-40 font-mono text-xs"
              />
            </div>
            <Button size="sm" onClick={() => void generate()} disabled={loading}>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileCode2 className="size-3.5" />
              )}
              Generate
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!output}
              onClick={copy}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!output}
              onClick={download}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </div>
        </>
      }
    >
      <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre">
        {output || "Click Generate to produce types for the selected language."}
      </pre>
    </StudioShell>
  )
}
