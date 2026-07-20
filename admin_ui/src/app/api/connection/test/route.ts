import { NextRequest, NextResponse } from "next/server"
import { buildConnectionString, type DbConnectionConfig } from "@/lib/connection"
import { metaFetch, MetaApiError } from "@/lib/meta"
import type { PostgresSchema } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DbConnectionConfig
    if (!body?.host || !body?.database || !body?.user) {
      return NextResponse.json(
        { error: "Host, database, and user are required." },
        { status: 400 }
      )
    }

    const connectionString = buildConnectionString(body)
    const schemas = await metaFetch<PostgresSchema[]>(
      "/schemas?include_system_schemas=false",
      connectionString
    )

    return NextResponse.json({
      ok: true,
      schemaCount: schemas.length,
      connection: {
        name: body.name || "Postgres",
        host: body.host,
        port: body.port,
        database: body.database,
        user: body.user,
      },
    })
  } catch (error) {
    if (error instanceof MetaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message =
      error instanceof Error ? error.message : "Failed to connect to database"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
