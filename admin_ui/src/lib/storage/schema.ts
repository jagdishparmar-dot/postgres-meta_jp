/**
 * Storage schema applied to each *project* database (not platform DB).
 * Logical buckets live here; bytes live in RustFS (one physical bucket per project).
 */
export const STORAGE_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL UNIQUE,
  public              boolean NOT NULL DEFAULT false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buckets_name_valid CHECK (name ~ '^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$')
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id    uuid NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name         text NOT NULL,
  owner        text,
  mime_type    text,
  size         bigint NOT NULL DEFAULT 0,
  etag         text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

ALTER TABLE storage.objects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

CREATE TABLE IF NOT EXISTS storage.policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  bucket_id   uuid REFERENCES storage.buckets(id) ON DELETE CASCADE,
  operation   text NOT NULL CHECK (operation IN ('SELECT','INSERT','UPDATE','DELETE','ALL')),
  definition  text NOT NULL DEFAULT '',
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS storage.lifecycle_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   uuid NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name        text NOT NULL,
  prefix      text NOT NULL DEFAULT '',
  days        integer NOT NULL CHECK (days > 0),
  action      text NOT NULL DEFAULT 'expire' CHECK (action IN ('expire')),
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

CREATE TABLE IF NOT EXISTS storage.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL,
  bucket_id    uuid,
  bucket_name  text,
  object_id    uuid,
  object_path  text,
  actor        text,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS objects_bucket_id_idx ON storage.objects (bucket_id);
CREATE INDEX IF NOT EXISTS objects_name_idx ON storage.objects (bucket_id, name);
CREATE INDEX IF NOT EXISTS objects_status_idx ON storage.objects (status);
CREATE INDEX IF NOT EXISTS policies_bucket_id_idx ON storage.policies (bucket_id);
CREATE INDEX IF NOT EXISTS lifecycle_bucket_id_idx ON storage.lifecycle_rules (bucket_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON storage.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON storage.audit_log (action);
`

export type StorageBucket = {
  id: string
  name: string
  public: boolean
  file_size_limit: number | null
  allowed_mime_types: string[] | null
  created_at: string
  updated_at: string
  object_count?: number
  total_bytes?: number
}

export type StorageObject = {
  id: string
  bucket_id: string
  bucket_name?: string
  name: string
  owner: string | null
  mime_type: string | null
  size: number
  etag: string | null
  metadata: Record<string, unknown>
  status?: string
  created_at: string
  updated_at: string
}

export type StoragePolicy = {
  id: string
  name: string
  bucket_id: string | null
  bucket_name?: string | null
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL"
  definition: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export type StorageLifecycleRule = {
  id: string
  bucket_id: string
  bucket_name?: string
  name: string
  prefix: string
  days: number
  action: "expire"
  enabled: boolean
  created_at: string
  updated_at: string
}

export type StorageAuditEntry = {
  id: string
  action: string
  bucket_id: string | null
  bucket_name: string | null
  object_id: string | null
  object_path: string | null
  actor: string | null
  details: Record<string, unknown>
  created_at: string
}
