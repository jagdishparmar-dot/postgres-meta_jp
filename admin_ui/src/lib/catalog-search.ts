import { fetchMeta } from "@/lib/client-meta"
import { studioPath } from "@/lib/platform/paths"
import type {
  PostgresFunction,
  PostgresSchema,
  PostgresTable,
  PostgresView,
} from "@/lib/types"

export type CatalogSearchKind =
  | "schema"
  | "table"
  | "column"
  | "view"
  | "function"

export type CatalogSearchItem = {
  id: string
  kind: CatalogSearchKind
  title: string
  subtitle: string
  href: string
  keywords: string
}

export async function loadCatalogSearchIndex(
  projectId: string
): Promise<CatalogSearchItem[]> {
  const [schemas, tables, views, functions] = await Promise.all([
    fetchMeta<PostgresSchema[]>("schemas?include_system_schemas=false"),
    fetchMeta<PostgresTable[]>(
      "tables?include_system_schemas=false&include_columns=true"
    ),
    fetchMeta<PostgresView[]>(
      "views?include_system_schemas=false&include_columns=false"
    ),
    fetchMeta<PostgresFunction[]>("functions?include_system_schemas=false"),
  ])

  const items: CatalogSearchItem[] = []

  for (const s of schemas) {
    items.push({
      id: `schema:${s.id}`,
      kind: "schema",
      title: s.name,
      subtitle: `Schema · owner ${s.owner}`,
      href: studioPath(projectId, "/schemas"),
      keywords: `schema ${s.name} ${s.owner}`,
    })
  }

  for (const t of tables) {
    items.push({
      id: `table:${t.id}`,
      kind: "table",
      title: `${t.schema}.${t.name}`,
      subtitle: `Table · ${t.columns?.length ?? 0} columns`,
      href: studioPath(
        projectId,
        `/tables/${encodeURIComponent(t.schema)}/${encodeURIComponent(t.name)}`
      ),
      keywords: `table ${t.schema} ${t.name}`,
    })
    for (const col of t.columns || []) {
      items.push({
        id: `column:${col.id}`,
        kind: "column",
        title: col.name,
        subtitle: `${t.schema}.${t.name} · ${col.format || col.data_type}`,
        href: studioPath(
          projectId,
          `/tables/${encodeURIComponent(t.schema)}/${encodeURIComponent(t.name)}`
        ),
        keywords: `column ${t.schema} ${t.name} ${col.name} ${col.format || col.data_type}`,
      })
    }
  }

  for (const v of views) {
    items.push({
      id: `view:${v.id}`,
      kind: "view",
      title: `${v.schema}.${v.name}`,
      subtitle: "View",
      href: studioPath(projectId, "/views"),
      keywords: `view ${v.schema} ${v.name}`,
    })
  }

  for (const fn of functions) {
    items.push({
      id: `function:${fn.id}`,
      kind: "function",
      title: `${fn.schema}.${fn.name}`,
      subtitle: `Function · ${fn.return_type}${fn.argument_types ? `(${fn.argument_types})` : ""}`,
      href: studioPath(projectId, "/functions"),
      keywords: `function ${fn.schema} ${fn.name} ${fn.argument_types} ${fn.return_type}`,
    })
  }

  return items
}

export function filterCatalogSearch(
  items: CatalogSearchItem[],
  query: string,
  limit = 40
): CatalogSearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return items
      .filter((i) => i.kind === "table" || i.kind === "schema")
      .slice(0, limit)
  }

  const scored = items
    .map((item) => {
      const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase()
      if (!hay.includes(q)) return null
      let score = 0
      if (item.title.toLowerCase() === q) score += 100
      if (item.title.toLowerCase().startsWith(q)) score += 50
      if (item.title.toLowerCase().includes(q)) score += 20
      if (item.kind === "table") score += 5
      if (item.kind === "function") score += 3
      return { item, score }
    })
    .filter((x): x is { item: CatalogSearchItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))

  return scored.slice(0, limit).map((s) => s.item)
}
