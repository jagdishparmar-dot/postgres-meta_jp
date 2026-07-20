"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchMeta } from "@/lib/client-meta"
import type { SavedConnection } from "@/lib/connection"

export function useMetaList<T>(
  path: string | null,
  connection: SavedConnection | null,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!connection || !path) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchMeta<T[]>(path, connection)
      setData(Array.isArray(result) ? result : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data"
      setError(message)
      setData([])
      toast.error(message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, path, ...deps])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh, setData }
}
