import { NextRequest, NextResponse } from "next/server"
import { resolveConnectionString } from "@/lib/connection-session"
import {
  clearPgNetResponses,
  enablePgNet,
  getPgNetStatus,
  listPgNetQueue,
  listPgNetResponses,
  sendPgNetRequest,
} from "@/lib/pg-net"

export const runtime = "nodejs"

async function conn(request: NextRequest) {
  const connectionString = await resolveConnectionString(request)
  if (!connectionString) {
    return {
      error: NextResponse.json(
        { error: "No active project connection." },
        { status: 401 }
      ),
    }
  }
  return { connectionString }
}

export async function GET(request: NextRequest) {
  const c = await conn(request)
  if ("error" in c) return c.error
  try {
    const status = await getPgNetStatus(c.connectionString)
    if (!status.installed) {
      return NextResponse.json({
        status,
        responses: [],
        queue: [],
      })
    }
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50)
    const [responses, queue] = await Promise.all([
      listPgNetResponses(c.connectionString, limit),
      listPgNetQueue(c.connectionString, limit),
    ])
    return NextResponse.json({ status, responses, queue })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load pg_net",
      },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  const c = await conn(request)
  if ("error" in c) return c.error
  try {
    const body = await request.json()
    if (body.action === "enable") {
      const status = await enablePgNet(c.connectionString)
      if (status.error) {
        return NextResponse.json({ status, error: status.error }, { status: 400 })
      }
      return NextResponse.json({ status })
    }
    if (body.action === "clear") {
      const deleted = await clearPgNetResponses(
        c.connectionString,
        Number(body.olderThanHours ?? 24)
      )
      return NextResponse.json({ deleted })
    }
    const result = await sendPgNetRequest(c.connectionString, {
      method: body.method || "GET",
      url: body.url,
      headers: body.headers,
      body: body.body,
      params: body.params,
      timeout_ms: body.timeout_ms,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send request",
      },
      { status: 400 }
    )
  }
}
