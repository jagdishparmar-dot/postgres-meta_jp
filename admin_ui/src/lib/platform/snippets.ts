import { platformQuery } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import type { SqlSnippet } from "@/lib/platform/types"

export type { SqlSnippet }

function mapSnippet(row: {
  id: string
  project_id: string
  title: string
  sql: string
  created_at: Date
  updated_at: Date
}): SqlSnippet {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    sql: row.sql,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

async function assertActiveProject(projectId: string) {
  const project = await getProject(projectId)
  if (!project || project.status !== "active") {
    throw new Error("Project not found or archived.")
  }
  return project
}

export async function listSnippets(projectId: string): Promise<SqlSnippet[]> {
  await assertActiveProject(projectId)
  const res = await platformQuery<{
    id: string
    project_id: string
    title: string
    sql: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, project_id, title, sql, created_at, updated_at
     FROM sql_snippets
     WHERE project_id = $1
     ORDER BY updated_at DESC`,
    [projectId]
  )
  return res.rows.map(mapSnippet)
}

export async function getSnippet(
  projectId: string,
  snippetId: string
): Promise<SqlSnippet | null> {
  await assertActiveProject(projectId)
  const res = await platformQuery<{
    id: string
    project_id: string
    title: string
    sql: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, project_id, title, sql, created_at, updated_at
     FROM sql_snippets
     WHERE id = $1 AND project_id = $2`,
    [snippetId, projectId]
  )
  const row = res.rows[0]
  return row ? mapSnippet(row) : null
}

export async function createSnippet(
  projectId: string,
  input: { title: string; sql: string }
): Promise<SqlSnippet> {
  await assertActiveProject(projectId)
  const title = input.title.trim()
  const sql = input.sql.trim()
  if (!title) throw new Error("Snippet title is required")
  if (!sql) throw new Error("Snippet SQL is required")

  const res = await platformQuery<{ id: string }>(
    `INSERT INTO sql_snippets (project_id, title, sql)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [projectId, title, sql]
  )
  const snippet = await getSnippet(projectId, res.rows[0].id)
  if (!snippet) throw new Error("Failed to load created snippet")
  return snippet
}

export async function updateSnippet(
  projectId: string,
  snippetId: string,
  patch: { title?: string; sql?: string }
): Promise<SqlSnippet | null> {
  await assertActiveProject(projectId)
  const current = await getSnippet(projectId, snippetId)
  if (!current) return null

  const title =
    patch.title === undefined ? current.title : patch.title.trim()
  const sql = patch.sql === undefined ? current.sql : patch.sql.trim()
  if (!title) throw new Error("Snippet title is required")
  if (!sql) throw new Error("Snippet SQL is required")

  await platformQuery(
    `UPDATE sql_snippets
     SET title = $3, sql = $4, updated_at = now()
     WHERE id = $1 AND project_id = $2`,
    [snippetId, projectId, title, sql]
  )
  return getSnippet(projectId, snippetId)
}

export async function deleteSnippet(
  projectId: string,
  snippetId: string
): Promise<boolean> {
  await assertActiveProject(projectId)
  const res = await platformQuery(
    `DELETE FROM sql_snippets WHERE id = $1 AND project_id = $2`,
    [snippetId, projectId]
  )
  return (res.rowCount ?? 0) > 0
}
