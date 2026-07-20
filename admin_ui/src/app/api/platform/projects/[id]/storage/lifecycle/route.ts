import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import {
  applyLifecycleRules,
  createLifecycleRule,
  deleteLifecycleRule,
  listLifecycleRules,
  updateLifecycleRule,
} from "@/lib/storage/ops"

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
    const rules = await listLifecycleRules(id)
    return NextResponse.json({ rules })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list rules",
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
    const body = await request.json()
    if (body.apply) {
      const result = await applyLifecycleRules(id, body.ruleId)
      return NextResponse.json(result)
    }
    const rule = await createLifecycleRule(id, body)
    return NextResponse.json({ rule })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create rule",
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
    const { id } = await context.params
    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    const rule = await updateLifecycleRule(id, body.id, body)
    return NextResponse.json({ rule })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update rule",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const ruleId = request.nextUrl.searchParams.get("ruleId")
    if (!ruleId) {
      return NextResponse.json({ error: "ruleId is required" }, { status: 400 })
    }
    await deleteLifecycleRule(id, ruleId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete rule",
      },
      { status: 400 }
    )
  }
}
