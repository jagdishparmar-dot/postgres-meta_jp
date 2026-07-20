import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import {
  createPolicy,
  deletePolicy,
  listPolicies,
  updatePolicy,
} from "@/lib/storage/security"

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
    const policies = await listPolicies(id)
    return NextResponse.json({ policies })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list policies",
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
    const policy = await createPolicy(id, body)
    return NextResponse.json({ policy })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create policy",
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
    const policy = await updatePolicy(id, body.id, body)
    return NextResponse.json({ policy })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update policy",
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
    const policyId = request.nextUrl.searchParams.get("policyId")
    if (!policyId) {
      return NextResponse.json(
        { error: "policyId is required" },
        { status: 400 }
      )
    }
    await deletePolicy(id, policyId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete policy",
      },
      { status: 400 }
    )
  }
}
