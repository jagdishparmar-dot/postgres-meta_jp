export type PlatformProject = {
  id: string
  name: string
  slug: string
  description: string | null
  database_name: string
  status: "active" | "archived"
  color: string | null
  read_only: boolean
  last_opened_at: string | null
  created_at: string
  updated_at: string
}

export type InstanceDatabase = {
  name: string
  owner: string
  size: string
  size_bytes: number
  linked_project_id?: string | null
  linked_project_name?: string | null
}

export type SqlSnippet = {
  id: string
  project_id: string
  title: string
  sql: string
  created_at: string
  updated_at: string
}
