import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import { getProjectRedisLink } from "@/lib/redis/link"
import {
  deleteRedisKey,
  getRedisValue,
  setRedisTtl,
} from "@/lib/redis/client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; key: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, key: rawKey } = await context.params
    const key = decodeURIComponent(rawKey)
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
    const entry = await getRedisValue(id, key)
    if (entry.type === "none") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }
    return NextResponse.json(entry)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read Redis key",
      },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, key: rawKey } = await context.params
    const key = decodeURIComponent(rawKey)
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
    const ttl =
      body.ttl_seconds === null || body.ttl_seconds === ""
        ? null
        : Number(body.ttl_seconds)
    await setRedisTtl(id, key, ttl != null && Number.isFinite(ttl) ? ttl : null)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update TTL",
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
    const { id, key: rawKey } = await context.params
    const key = decodeURIComponent(rawKey)
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
    const deleted = await deleteRedisKey(id, key)
    return NextResponse.json({ deleted })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete Redis key",
      },
      { status: 400 }
    )
  }
}
