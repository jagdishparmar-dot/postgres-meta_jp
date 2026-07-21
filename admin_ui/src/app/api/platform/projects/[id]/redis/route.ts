import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import {
  getProjectRedisLink,
  getRedisPlatformStatus,
  linkProjectRedisCustom,
  linkProjectRedisDb,
  unlinkProjectRedis,
} from "@/lib/redis/link"
import {
  getRedisInfo,
  pingRedis,
  testProjectRedis,
} from "@/lib/redis/client"
import {
  getSharedRedisUrl,
  normalizeRedisUrl,
  withRedisDb,
} from "@/lib/redis/url"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    const [link, platform] = await Promise.all([
      getProjectRedisLink(id),
      getRedisPlatformStatus(),
    ])
    let info = null
    let ping = null
    if (link.linked) {
      try {
        ;[info, ping] = await Promise.all([
          getRedisInfo(id),
          testProjectRedis(id),
        ])
      } catch (err) {
        return NextResponse.json({
          link,
          platform,
          info: null,
          ping: null,
          connection_error:
            err instanceof Error ? err.message : "Connection failed",
        })
      }
    }
    return NextResponse.json({ link, platform, info, ping })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load Redis link",
      },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const action = body.action as string

    if (action === "test") {
      // Test shared REDIS_URL (optionally at a DB index) or a custom URL
      if (body.redis_url) {
        const url = normalizeRedisUrl(String(body.redis_url))
        return NextResponse.json(await pingRedis(url))
      }
      const shared = getSharedRedisUrl()
      if (!shared) {
        return NextResponse.json(
          { error: "REDIS_URL is not configured" },
          { status: 400 }
        )
      }
      const db =
        body.redis_db != null && body.redis_db !== ""
          ? Number(body.redis_db)
          : 0
      const url = withRedisDb(shared, db)
      return NextResponse.json(await pingRedis(url))
    }

    if (action === "link" || action === "link_db") {
      const preferred =
        body.redis_db != null && body.redis_db !== ""
          ? Number(body.redis_db)
          : null
      const link = await linkProjectRedisDb(id, preferred)
      const [info, platform] = await Promise.all([
        getRedisInfo(id),
        getRedisPlatformStatus(),
      ])
      return NextResponse.json({ link, info, platform })
    }

    if (action === "link_custom") {
      const url = normalizeRedisUrl(String(body.redis_url || ""))
      await pingRedis(url)
      const link = await linkProjectRedisCustom(id, url)
      const info = await getRedisInfo(id)
      const platform = await getRedisPlatformStatus()
      return NextResponse.json({ link, info, platform })
    }

    if (action === "unlink") {
      const link = await unlinkProjectRedis(id)
      const platform = await getRedisPlatformStatus()
      return NextResponse.json({ link, platform })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Redis operation failed",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    const link = await unlinkProjectRedis(id)
    const platform = await getRedisPlatformStatus()
    return NextResponse.json({ link, platform })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to unlink Redis",
      },
      { status: 400 }
    )
  }
}
