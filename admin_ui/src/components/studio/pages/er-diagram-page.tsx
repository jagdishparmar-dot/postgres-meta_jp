"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import { studioPath } from "@/lib/platform/paths"
import { fetchMeta } from "@/lib/client-meta"
import {
  buildErGraph,
  edgePath,
  graphBounds,
  type ErNode,
} from "@/lib/er-diagram"
import type { PostgresTable } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ErDiagramPageClient() {
  const router = useRouter()
  const { projectId } = useProject()
  const { connection, ready } = useStudioConnection()
  const [tables, setTables] = useState<PostgresTable[]>([])
  const [loading, setLoading] = useState(true)
  const [schema, setSchema] = useState<string>("public")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.9)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    panX: number
    panY: number
  }>({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })

  async function load() {
    if (!connection) return
    setLoading(true)
    try {
      const data = await fetchMeta<PostgresTable[]>(
        "tables?include_system_schemas=false&include_columns=true",
        connection
      )
      setTables(Array.isArray(data) ? data : [])
      const schemas = [...new Set(data.map((t) => t.schema))].sort()
      if (schemas.length && !schemas.includes(schema)) {
        setSchema(schemas.includes("public") ? "public" : schemas[0])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tables")
      setTables([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ready && connection) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, connection])

  const schemas = useMemo(
    () => [...new Set(tables.map((t) => t.schema))].sort(),
    [tables]
  )

  const { nodes, edges } = useMemo(
    () => buildErGraph(tables, schema || null),
    [tables, schema]
  )
  const bounds = useMemo(() => graphBounds(nodes), [nodes])
  const nodeMap = useMemo(() => {
    const m = new Map<string, ErNode>()
    for (const n of nodes) m.set(n.id, n)
    return m
  }, [nodes])


  useStudioPage({
    title: "ER diagram",
    subtitle: "Tables and foreign-key relationships",
    refreshing: loading,
    onRefresh: () => void load(),
    toolbar: (
      <>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Schema</label>
          <select
            className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            value={schema}
            onChange={(e) => {
              setSchema(e.target.value)
              setSelectedId(null)
              setPan({ x: 0, y: 0 })
            }}
          >
            {schemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {!schemas.length ? <option value="public">public</option> : null}
          </select>
          <Badge variant="secondary" className="font-normal">
            {nodes.length} tables · {edges.length} relations
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="w-12 text-center font-mono text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
          >
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
      </>
    ),
  })

  return (
    <div
        className="relative h-[calc(100vh-11rem)] cursor-grab overflow-hidden bg-[radial-gradient(circle_at_1px_1px,oklch(1_0_0_/_0.06)_1px,transparent_0)] bg-size-[18px_18px] active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-er-node]")) return
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            panX: pan.x,
            panY: pan.y,
          }
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return
          setPan({
            x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
          })
        }}
        onPointerUp={() => {
          dragRef.current.active = false
        }}
        onPointerLeave={() => {
          dragRef.current.active = false
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading diagram…
          </div>
        ) : !nodes.length ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No tables in this schema
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            className="block"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <defs>
              <marker
                id="er-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary/70" />
              </marker>
            </defs>

            <g>
              {edges.map((edge) => {
                const from = nodeMap.get(edge.fromId)
                const to = nodeMap.get(edge.toId)
                if (!from || !to) return null
                const { d, labelX, labelY } = edgePath(from, to)
                const active =
                  selectedId === edge.fromId || selectedId === edge.toId
                return (
                  <g key={edge.id} className={active ? "opacity-100" : "opacity-50"}>
                    <path
                      d={d}
                      fill="none"
                      className="stroke-primary/60"
                      strokeWidth={1.5}
                      markerEnd="url(#er-arrow)"
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px]"
                    >
                      {edge.fromColumns.join(",")} → {edge.toColumns.join(",")}
                    </text>
                  </g>
                )
              })}
            </g>

            <g>
              {nodes.map((node) => {
                const selected = selectedId === node.id
                return (
                  <g
                    key={node.id}
                    data-er-node
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(node.id)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      router.push(
                        studioPath(
                          projectId,
                          `/tables/${encodeURIComponent(node.schema)}/${encodeURIComponent(node.name)}`
                        )
                      )
                    }}
                  >
                    <rect
                      width={node.width}
                      height={node.height}
                      rx={10}
                      className={cn(
                        "fill-card stroke-border",
                        selected && "stroke-primary"
                      )}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <rect
                      width={node.width}
                      height={36}
                      rx={10}
                      className="fill-primary/15"
                    />
                    <rect
                      y={18}
                      width={node.width}
                      height={18}
                      className="fill-primary/15"
                    />
                    <text
                      x={12}
                      y={23}
                      className="fill-foreground text-[12px] font-medium"
                    >
                      {node.name}
                    </text>
                    {node.columns.map((col, i) => (
                      <g key={col.name}>
                        <text
                          x={14}
                          y={52 + i * 22}
                          className="fill-foreground font-mono text-[10px]"
                        >
                          {col.isPk ? "PK " : col.isFk ? "FK " : "   "}
                          {col.name}
                        </text>
                        <text
                          x={node.width - 12}
                          y={52 + i * 22}
                          textAnchor="end"
                          className="fill-muted-foreground font-mono text-[9px]"
                        >
                          {col.type}
                        </text>
                      </g>
                    ))}
                  </g>
                )
              })}
            </g>

            {/* invisible canvas size hint */}
            <rect
              width={bounds.width}
              height={bounds.height}
              fill="transparent"
              pointerEvents="none"
            />
          </svg>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          <KeyRound className="size-3" />
          Drag to pan · double-click table to open · scroll zoom via buttons
        </div>
      </div>
  )
}
