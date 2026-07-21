import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import { getProjectRedisLink } from "@/lib/redis/link"
import { scanRedisKeys, setRedisString } from "@/lib/redis/client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
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
    const link = await getProjectRedisLink(id)
    if (!link.linked) {
      return NextResponse.json(
        { error: "Redis is not linked to this project" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const result = await scanRedisKeys(id, {
      match: searchParams.get("match") || undefined,
      cursor: searchParams.get("cursor") || undefined,
      count: searchParams.get("count")
        ? Number(searchParams.get("count"))
        : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to scan Redis keys",
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
    const link = await getProjectRedisLink(id)
    if (!link.linked) {
      return NextResponse.json(
        { error: "Redis is not linked to this project" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const key = String(body.key || "").trim()
    const value = body.value != null ? String(body.value) : ""
    const ttlSeconds =
      body.ttl_seconds != null && body.ttl_seconds !== ""
        ? Number(body.ttl_seconds)
        : null

    await setRedisString(id, {
      key,
      value,
      ttlSeconds:
        ttlSeconds != null && Number.isFinite(ttlSeconds) ? ttlSeconds : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to set Redis key",
      },
      { status: 400 }
    )
  }
}
