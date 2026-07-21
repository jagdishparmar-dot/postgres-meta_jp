"use client"

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type StudioPageMeta = {
  title?: string
  subtitle?: string
  onRefresh?: () => void
  refreshing?: boolean
  toolbar?: ReactNode
  contentVariant?: "default" | "flush"
}

type StudioPageMetaContextValue = {
  meta: StudioPageMeta
  setMeta: (meta: StudioPageMeta) => void
}

const StudioPageMetaContext = createContext<StudioPageMetaContextValue | null>(
  null
)

function metaShellEqual(a: StudioPageMeta, b: StudioPageMeta) {
  return (
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.refreshing === b.refreshing &&
    a.contentVariant === b.contentVariant &&
    a.onRefresh === b.onRefresh &&
    a.toolbar === b.toolbar
  )
}

export function StudioPageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<StudioPageMeta>({})
  const setMeta = useCallback((next: StudioPageMeta) => {
    setMetaState((prev) => (metaShellEqual(prev, next) ? prev : next))
  }, [])
  const value = useMemo(
    () => ({
      meta,
      setMeta,
    }),
    [meta, setMeta]
  )
  return (
    <StudioPageMetaContext.Provider value={value}>
      {children}
    </StudioPageMetaContext.Provider>
  )
}

export function useStudioPageMetaContext() {
  return useContext(StudioPageMetaContext)
}

/** Register page chrome on the persistent database layout (no remount on nav). */
export function useStudioPage(meta: StudioPageMeta, syncDeps: unknown[] = []) {
  const ctx = useStudioPageMetaContext()
  const metaRef = useRef(meta)
  metaRef.current = meta
  const setMetaRef = useRef(ctx?.setMeta)
  setMetaRef.current = ctx?.setMeta

  useLayoutEffect(() => {
    setMetaRef.current?.(metaRef.current)
    return () => setMetaRef.current?.({})
    // Volatile fields (toolbar, onRefresh) live in metaRef; sync when shell fields
    // or optional syncDeps change — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    meta.title,
    meta.subtitle,
    meta.refreshing,
    meta.contentVariant,
    ...syncDeps,
  ])
}
