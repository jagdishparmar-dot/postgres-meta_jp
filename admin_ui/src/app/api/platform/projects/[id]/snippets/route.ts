import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { createSnippet, listSnippets } from "@/lib/platform/snippets"

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
    const snippets = await listSnippets(id)
    return NextResponse.json({ snippets })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list snippets",
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
    const body = (await request.json()) as { title?: string; sql?: string }
    const snippet = await createSnippet(id, {
      title: body.title || "",
      sql: body.sql || "",
    })
    return NextResponse.json({ snippet })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create snippet",
      },
      { status: 400 }
    )
  }
}
