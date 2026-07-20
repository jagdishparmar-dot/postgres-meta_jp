import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import {
  deleteSnippet,
  getSnippet,
  updateSnippet,
} from "@/lib/platform/snippets"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; snippetId: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, snippetId } = await context.params
    const snippet = await getSnippet(id, snippetId)
    if (!snippet) {
      return NextResponse.json({ error: "Snippet not found." }, { status: 404 })
    }
    return NextResponse.json({ snippet })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load snippet",
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
    const { id, snippetId } = await context.params
    const body = (await request.json()) as { title?: string; sql?: string }
    const snippet = await updateSnippet(id, snippetId, body)
    if (!snippet) {
      return NextResponse.json({ error: "Snippet not found." }, { status: 404 })
    }
    return NextResponse.json({ snippet })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update snippet",
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
    const { id, snippetId } = await context.params
    const ok = await deleteSnippet(id, snippetId)
    if (!ok) {
      return NextResponse.json({ error: "Snippet not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete snippet",
      },
      { status: 400 }
    )
  }
}
