import { Suspense } from "react"
import { SqlEditorPageClient } from "@/components/studio/pages/sql-editor-page"

export default function SqlEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading SQL editor…
        </div>
      }
    >
      <SqlEditorPageClient />
    </Suspense>
  )
}
