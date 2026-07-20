import type { PostgresRelationship, PostgresTable } from "@/lib/types"
import { groupOutgoingForeignKeys } from "@/lib/schema-ddl"

export type ErNode = {
  id: string
  schema: string
  name: string
  x: number
  y: number
  width: number
  height: number
  columns: { name: string; type: string; isPk: boolean; isFk: boolean }[]
}

export type ErEdge = {
  id: string
  fromId: string
  toId: string
  label: string
  fromColumns: string[]
  toColumns: string[]
}

const NODE_WIDTH = 220
const COL_HEIGHT = 22
const HEADER_HEIGHT = 36
const H_GAP = 80
const V_GAP = 56
const COLS = 4

export function buildErGraph(
  tables: PostgresTable[],
  schemaFilter?: string | null
): { nodes: ErNode[]; edges: ErEdge[] } {
  const filtered = schemaFilter
    ? tables.filter((t) => t.schema === schemaFilter)
    : tables

  const nodes: ErNode[] = filtered.map((t, index) => {
    const pk = new Set((t.primary_keys || []).map((p) => p.name))
    const fks = new Set(
      groupOutgoingForeignKeys(t).flatMap((fk) => fk.columns)
    )
    const columns = [...(t.columns || [])]
      .sort((a, b) => a.ordinal_position - b.ordinal_position)
      .slice(0, 12)
      .map((c) => ({
        name: c.name,
        type: c.format || c.data_type,
        isPk: pk.has(c.name),
        isFk: fks.has(c.name),
      }))

    const col = index % COLS
    const row = Math.floor(index / COLS)
    const height = HEADER_HEIGHT + Math.max(columns.length, 1) * COL_HEIGHT + 8

    return {
      id: `${t.schema}.${t.name}`,
      schema: t.schema,
      name: t.name,
      x: 40 + col * (NODE_WIDTH + H_GAP),
      y: 40 + row * (180 + V_GAP),
      width: NODE_WIDTH,
      height,
      columns,
    }
  })

  // Re-layout rows with actual heights for less overlap
  const rowHeights: number[] = []
  nodes.forEach((n, index) => {
    const row = Math.floor(index / COLS)
    rowHeights[row] = Math.max(rowHeights[row] || 0, n.height)
  })
  let yCursor = 40
  const rowY: number[] = []
  for (let r = 0; r < rowHeights.length; r++) {
    rowY[r] = yCursor
    yCursor += rowHeights[r] + V_GAP
  }
  nodes.forEach((n, index) => {
    const row = Math.floor(index / COLS)
    n.y = rowY[row]
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: ErEdge[] = []
  const seen = new Set<string>()

  for (const t of filtered) {
    const fromId = `${t.schema}.${t.name}`
    for (const fk of groupOutgoingForeignKeys(t)) {
      const toId = `${fk.referenced_schema}.${fk.referenced_table}`
      if (!nodeIds.has(fromId) || !nodeIds.has(toId)) continue
      const edgeId = `${fk.constraint_name}:${fromId}->${toId}`
      if (seen.has(edgeId)) continue
      seen.add(edgeId)
      edges.push({
        id: edgeId,
        fromId,
        toId,
        label: fk.constraint_name,
        fromColumns: fk.columns,
        toColumns: fk.referenced_columns,
      })
    }
  }

  // Also pick up relationships that may only appear as inbound rows
  for (const t of filtered) {
    for (const r of t.relationships || []) {
      const fromId = `${r.source_schema}.${r.source_table_name}`
      const toId = `${r.target_table_schema}.${r.target_table_name}`
      if (!nodeIds.has(fromId) || !nodeIds.has(toId)) continue
      const edgeId = `${r.constraint_name}:${fromId}->${toId}`
      if (seen.has(edgeId)) continue
      seen.add(edgeId)
      edges.push({
        id: edgeId,
        fromId,
        toId,
        label: r.constraint_name,
        fromColumns: [r.source_column_name],
        toColumns: [r.target_column_name],
      })
    }
  }

  return { nodes, edges }
}

export function edgePath(
  from: ErNode,
  to: ErNode
): { d: string; labelX: number; labelY: number } {
  const x1 = from.x + from.width
  const y1 = from.y + Math.min(from.height / 2, HEADER_HEIGHT + 40)
  const x2 = to.x
  const y2 = to.y + Math.min(to.height / 2, HEADER_HEIGHT + 40)

  // If target is to the left / same column, route from mid sides
  let startX = x1
  let startY = y1
  let endX = x2
  let endY = y2

  if (to.x + to.width < from.x) {
    startX = from.x
    endX = to.x + to.width
  } else if (Math.abs(to.x - from.x) < 20) {
    startX = from.x + from.width / 2
    startY = from.y + from.height
    endX = to.x + to.width / 2
    endY = to.y
  }

  const dx = Math.max(Math.abs(endX - startX) * 0.4, 40)
  const c1x = startX + (endX >= startX ? dx : -dx)
  const c2x = endX - (endX >= startX ? dx : -dx)
  const d = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
  return {
    d,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 6,
  }
}

export function graphBounds(nodes: ErNode[]): {
  width: number
  height: number
} {
  if (!nodes.length) return { width: 800, height: 400 }
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  return { width: maxX + 80, height: maxY + 80 }
}

export type { PostgresRelationship }
