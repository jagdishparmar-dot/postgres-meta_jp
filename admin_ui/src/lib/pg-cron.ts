import { Client } from "pg"

export type CronExtensionStatus = {
  installed: boolean
  available: boolean
  error?: string
}

export type CronJob = {
  jobid: number
  schedule: string
  command: string
  nodename: string | null
  nodeport: number | null
  database: string | null
  username: string | null
  active: boolean
  jobname: string | null
}

export type CronJobRun = {
  jobid: number
  runid: number
  job_pid: number | null
  database: string | null
  username: string | null
  command: string | null
  status: string | null
  return_message: string | null
  start_time: string | null
  end_time: string | null
}

async function withClient<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function getCronStatus(
  connectionString: string
): Promise<CronExtensionStatus> {
  return withClient(connectionString, async (client) => {
    const installed = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
       ) AS exists`
    )
    const available = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
       ) AS exists`
    )
    return {
      installed: Boolean(installed.rows[0]?.exists),
      available: Boolean(available.rows[0]?.exists),
    }
  })
}

export async function enableCron(
  connectionString: string
): Promise<CronExtensionStatus> {
  return withClient(connectionString, async (client) => {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_cron`)
    } catch (err) {
      const status = await getCronStatus(connectionString)
      return {
        ...status,
        error:
          err instanceof Error
            ? err.message
            : "Failed to enable pg_cron. It often requires shared_preload_libraries='pg_cron' and a restart.",
      }
    }
    return getCronStatus(connectionString)
  })
}

export async function listCronJobs(
  connectionString: string
): Promise<CronJob[]> {
  return withClient(connectionString, async (client) => {
    const res = await client.query(
      `SELECT jobid, schedule, command, nodename, nodeport, database,
              username, active, jobname
       FROM cron.job
       ORDER BY jobid`
    )
    return res.rows.map((r) => ({
      jobid: Number(r.jobid),
      schedule: r.schedule,
      command: r.command,
      nodename: r.nodename,
      nodeport: r.nodeport == null ? null : Number(r.nodeport),
      database: r.database,
      username: r.username,
      active: Boolean(r.active),
      jobname: r.jobname,
    }))
  })
}

export async function listCronRuns(
  connectionString: string,
  opts?: { jobid?: number; limit?: number }
): Promise<CronJobRun[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  return withClient(connectionString, async (client) => {
    const res = await client.query(
      `SELECT jobid, runid, job_pid, database, username, command,
              status, return_message, start_time, end_time
       FROM cron.job_run_details
       WHERE ($1::bigint IS NULL OR jobid = $1)
       ORDER BY start_time DESC NULLS LAST
       LIMIT $2`,
      [opts?.jobid ?? null, limit]
    )
    return res.rows.map((r) => ({
      jobid: Number(r.jobid),
      runid: Number(r.runid),
      job_pid: r.job_pid == null ? null : Number(r.job_pid),
      database: r.database,
      username: r.username,
      command: r.command,
      status: r.status,
      return_message: r.return_message,
      start_time: r.start_time ? new Date(r.start_time).toISOString() : null,
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
    }))
  })
}

export async function scheduleCronJob(
  connectionString: string,
  input: { name?: string; schedule: string; command: string }
): Promise<number> {
  const schedule = input.schedule.trim()
  const command = input.command.trim()
  if (!schedule) throw new Error("Schedule is required (cron expression)")
  if (!command) throw new Error("SQL command is required")

  return withClient(connectionString, async (client) => {
    if (input.name?.trim()) {
      const res = await client.query<{ schedule: number }>(
        `SELECT cron.schedule($1, $2, $3) AS schedule`,
        [input.name.trim(), schedule, command]
      )
      return Number(res.rows[0].schedule)
    }
    const res = await client.query<{ schedule: number }>(
      `SELECT cron.schedule($1, $2) AS schedule`,
      [schedule, command]
    )
    return Number(res.rows[0].schedule)
  })
}

export async function alterCronJob(
  connectionString: string,
  input: {
    jobid: number
    schedule?: string | null
    command?: string | null
    active?: boolean | null
  }
): Promise<void> {
  return withClient(connectionString, async (client) => {
    await client.query(
      `SELECT cron.alter_job(
         $1::bigint,
         $2::text,
         $3::text,
         NULL::text,
         NULL::text,
         $4::boolean
       )`,
      [
        input.jobid,
        input.schedule ?? null,
        input.command ?? null,
        input.active ?? null,
      ]
    )
  })
}

export async function unscheduleCronJob(
  connectionString: string,
  jobid: number
): Promise<void> {
  return withClient(connectionString, async (client) => {
    await client.query(`SELECT cron.unschedule($1::bigint)`, [jobid])
  })
}

/** Run the job command once immediately (does not wait for cron). */
export async function runCronJobNow(
  connectionString: string,
  jobid: number
): Promise<{ ok: boolean; message?: string }> {
  return withClient(connectionString, async (client) => {
    const job = await client.query<{ command: string }>(
      `SELECT command FROM cron.job WHERE jobid = $1`,
      [jobid]
    )
    if (!job.rows[0]) throw new Error("Job not found")
    try {
      await client.query(job.rows[0].command)
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Command failed",
      }
    }
  })
}
