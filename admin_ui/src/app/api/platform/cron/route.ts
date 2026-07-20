import { NextRequest, NextResponse } from "next/server"
import { resolveConnectionString } from "@/lib/connection-session"
import {
  alterCronJob,
  enableCron,
  getCronStatus,
  listCronJobs,
  listCronRuns,
  runCronJobNow,
  scheduleCronJob,
  unscheduleCronJob,
} from "@/lib/pg-cron"

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
    const status = await getCronStatus(c.connectionString)
    if (!status.installed) {
      return NextResponse.json({ status, jobs: [], runs: [] })
    }
    const jobidParam = request.nextUrl.searchParams.get("jobid")
    const jobid = jobidParam ? Number(jobidParam) : undefined
    const [jobs, runs] = await Promise.all([
      listCronJobs(c.connectionString),
      listCronRuns(c.connectionString, {
        jobid: Number.isFinite(jobid) ? jobid : undefined,
        limit: Number(request.nextUrl.searchParams.get("limit") || 50),
      }),
    ])
    return NextResponse.json({ status, jobs, runs })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load cron",
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
      const status = await enableCron(c.connectionString)
      if (status.error) {
        return NextResponse.json({ status, error: status.error }, { status: 400 })
      }
      return NextResponse.json({ status })
    }
    if (body.action === "run") {
      const result = await runCronJobNow(c.connectionString, Number(body.jobid))
      return NextResponse.json(result)
    }
    const jobid = await scheduleCronJob(c.connectionString, {
      name: body.name,
      schedule: body.schedule,
      command: body.command,
    })
    return NextResponse.json({ jobid })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to schedule job",
      },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const c = await conn(request)
  if ("error" in c) return c.error
  try {
    const body = await request.json()
    if (!body.jobid) {
      return NextResponse.json({ error: "jobid is required" }, { status: 400 })
    }
    await alterCronJob(c.connectionString, {
      jobid: Number(body.jobid),
      schedule: body.schedule,
      command: body.command,
      active: body.active,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to alter job",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const c = await conn(request)
  if ("error" in c) return c.error
  try {
    const jobid = Number(request.nextUrl.searchParams.get("jobid"))
    if (!Number.isFinite(jobid)) {
      return NextResponse.json({ error: "jobid is required" }, { status: 400 })
    }
    await unscheduleCronJob(c.connectionString, jobid)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to unschedule job",
      },
      { status: 400 }
    )
  }
}
