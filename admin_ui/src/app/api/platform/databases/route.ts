import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { listDatabasesForLinking } from "@/lib/platform/projects"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const availableOnly =
      request.nextUrl.searchParams.get("available") === "true"
    let databases = await listDatabasesForLinking()
    if (availableOnly) {
      databases = databases.filter((d) => !d.linked_project_id)
    }
    return NextResponse.json({ databases })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list instance databases",
      },
      { status: 500 }
    )
  }
}
