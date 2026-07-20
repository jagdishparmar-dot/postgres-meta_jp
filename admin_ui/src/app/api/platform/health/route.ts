import { NextResponse } from "next/server"
import {
  getMasterUrl,
  getPlatformDatabaseUrl,
  isPlatformConfigured,
  maskUrlHostDb,
} from "@/lib/platform/db"
import { getSchemaVersion } from "@/lib/platform/projects"

export const runtime = "nodejs"

export async function GET() {
  const masterUrl = getMasterUrl()
  const platformUrl = getPlatformDatabaseUrl()
  const configured = isPlatformConfigured()

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      migrated: false,
      schemaVersion: null,
      masterConfigured: Boolean(masterUrl),
      platformConfigured: Boolean(platformUrl),
      masterDatabase: maskUrlHostDb(masterUrl),
      platformDatabase: maskUrlHostDb(platformUrl),
      error:
        "Set PG_MASTER_URL and PLATFORM_DATABASE_URL in .env.local, then run npm run platform:setup.",
    })
  }

  try {
    const schemaVersion = await getSchemaVersion()
    if (!schemaVersion) {
      return NextResponse.json({
        ok: false,
        configured: true,
        migrated: false,
        schemaVersion: null,
        masterConfigured: true,
        platformConfigured: true,
        masterDatabase: maskUrlHostDb(masterUrl),
        platformDatabase: maskUrlHostDb(platformUrl),
        error:
          "Platform DB reachable but schema missing. Run npm run platform:setup.",
      })
    }

    const migrated = Number(schemaVersion) >= 3

    return NextResponse.json({
      ok: migrated,
      configured: true,
      migrated,
      schemaVersion,
      masterConfigured: true,
      platformConfigured: true,
      masterDatabase: maskUrlHostDb(masterUrl),
      platformDatabase: maskUrlHostDb(platformUrl),
      error: migrated
        ? undefined
        : "Schema is outdated. Run npm run platform:setup to apply migrations.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        migrated: false,
        schemaVersion: null,
        masterConfigured: true,
        platformConfigured: true,
        masterDatabase: maskUrlHostDb(masterUrl),
        platformDatabase: maskUrlHostDb(platformUrl),
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach platform database",
      },
      { status: 503 }
    )
  }
}
