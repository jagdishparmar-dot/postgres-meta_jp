const projectId = "34c38471-95d8-4c05-a322-8e68d067a9a5"
const base = `http://localhost:3000/api/platform/projects/${projectId}/redis`

const results = []

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json, text }
}

function pass(name, detail) {
  results.push({ name, ok: true, detail })
  console.log(`PASS  ${name} — ${detail}`)
}

function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.log(`FAIL  ${name} — ${detail}`)
}

async function main() {
  console.log(`Target: ${base}\n`)

  // 1 GET status
  {
    const r = await api("GET", base)
    if (r.status === 200 && r.json?.link && r.json?.platform) {
      pass(
        "1 GET /redis",
        `linked=${r.json.link.linked} mode=${r.json.link.mode} db=${r.json.link.db} configured=${r.json.platform.configured} ping=${r.json.ping?.pong ?? "-"} cerr=${r.json.connection_error ?? "-"}`
      )
    } else {
      fail("1 GET /redis", `${r.status} ${r.text}`)
    }
  }

  const before = await api("GET", base)
  const wasLinked = Boolean(before.json?.link?.linked)

  // 2 POST test
  {
    const r = await api("POST", base, { action: "test", redis_db: 0 })
    if (r.status === 200 && r.json?.ok) pass("2 POST test", `pong=${r.json.pong}`)
    else fail("2 POST test", `${r.status} ${r.text}`)
  }

  // 3 Unlink
  if (wasLinked) {
    const r = await api("DELETE", base)
    if (r.status === 200 && !r.json?.link?.linked) {
      pass("3 DELETE unlink", `available=${(r.json.platform?.available_dbs || []).join(",")}`)
    } else fail("3 DELETE unlink", `${r.status} ${r.text}`)
  } else {
    pass("3 DELETE unlink (skip)", "already unlinked")
  }

  // 4 link_db auto
  {
    const r = await api("POST", base, { action: "link_db" })
    if (r.status === 200 && r.json?.link?.linked && r.json.link.db != null) {
      pass(
        "4 POST link_db auto",
        `db=${r.json.link.db} mode=${r.json.link.mode} ver=${r.json.info?.redis_version}`
      )
    } else fail("4 POST link_db auto", `${r.status} ${r.text}`)
  }

  const testKey = `pgadmin:test:${Date.now()}`

  // 5 SET
  {
    const r = await api("POST", `${base}/keys`, {
      key: testKey,
      value: "hello-redis-test",
      ttl_seconds: 120,
    })
    if (r.status === 200 && r.json?.ok) pass("5 POST /keys set", `key=${testKey}`)
    else fail("5 POST /keys set", `${r.status} ${r.text}`)
  }

  // 6 SCAN
  {
    const r = await api(
      "GET",
      `${base}/keys?match=${encodeURIComponent("pgadmin:test:*")}&cursor=0&count=50`
    )
    const found = r.json?.keys?.find((k) => k.key === testKey)
    if (r.status === 200 && found) {
      pass("6 GET /keys scan", `type=${found.type} ttl=${found.ttl}`)
    } else fail("6 GET /keys scan", `${r.status} ${r.text}`)
  }

  const enc = encodeURIComponent(testKey)

  // 7 GET key
  {
    const r = await api("GET", `${base}/keys/${enc}`)
    if (r.status === 200 && r.json?.value === "hello-redis-test") {
      pass("7 GET /keys/{key}", `type=${r.json.type} ttl=${r.json.ttl} value=${r.json.value}`)
    } else fail("7 GET /keys/{key}", `${r.status} ${r.text}`)
  }

  // 8 PATCH TTL
  {
    const r = await api("PATCH", `${base}/keys/${enc}`, { ttl_seconds: 60 })
    const g = await api("GET", `${base}/keys/${enc}`)
    if (r.status === 200 && g.json?.ttl > 0 && g.json.ttl <= 60) {
      pass("8 PATCH ttl", `ttl=${g.json.ttl}`)
    } else fail("8 PATCH ttl", `${r.status}/${g.status} ${r.text} ${g.text}`)
  }

  // 9 DELETE key
  {
    const r = await api("DELETE", `${base}/keys/${enc}`)
    const g = await api("GET", `${base}/keys/${enc}`)
    if (r.status === 200 && r.json?.deleted >= 1 && g.status === 404) {
      pass("9 DELETE key", `deleted=${r.json.deleted} get_status=${g.status}`)
    } else fail("9 DELETE key", `${r.status}/${g.status} ${r.text} ${g.text}`)
  }

  // 10 platform inventory
  {
    const r = await api("GET", base)
    if (r.status === 200 && r.json?.platform?.configured) {
      pass(
        "10 platform inventory",
        `used=[${(r.json.platform.used_dbs || []).join(",")}] free=${r.json.platform.available_dbs?.length}`
      )
    } else fail("10 platform inventory", `${r.status} ${r.text}`)
  }

  // 11 unknown action
  {
    const r = await api("POST", base, { action: "nope" })
    if (r.status === 400) pass("11 unknown action → 400", r.json?.error || "ok")
    else fail("11 unknown action → 400", `${r.status} ${r.text}`)
  }

  // 12 empty key
  {
    const r = await api("POST", `${base}/keys`, { key: "", value: "x" })
    if (r.status === 400) pass("12 set empty key → 400", r.json?.error || "ok")
    else fail("12 set empty key → 400", `${r.status} ${r.text}`)
  }

  // 13 persist TTL
  {
    const k2 = `pgadmin:test:persist-${Date.now()}`
    await api("POST", `${base}/keys`, { key: k2, value: "persist-me", ttl_seconds: 30 })
    const enc2 = encodeURIComponent(k2)
    const r = await api("PATCH", `${base}/keys/${enc2}`, { ttl_seconds: null })
    const g = await api("GET", `${base}/keys/${enc2}`)
    if (r.status === 200 && g.json?.ttl === -1) {
      pass("13 PATCH persist", `ttl=${g.json.ttl}`)
    } else fail("13 PATCH persist", `${r.status}/${g.status} ttl=${g.json?.ttl} ${r.text}`)
    await api("DELETE", `${base}/keys/${enc2}`)
  }

  // 14 link specific free db then conflict
  {
    const status = await api("GET", base)
    const free = status.json?.platform?.available_dbs || []
    if (free.length === 0) {
      pass("14 duplicate DB conflict (skip)", "no free DB to test conflict")
    } else {
      // already linked; try linking same db via another project's id if we only have one project —
      // instead: unlink, link to free[0], then try link_db with same db again on same project after unlink... 
      // Better: attempt link_db with a used db while still linked (should fail unique or allocate)
      const used = status.json.platform.used_dbs[0]
      await api("DELETE", base)
      await api("POST", base, { action: "link_db", redis_db: used })
      const conflict = await api("POST", base, { action: "link_db", redis_db: used })
      // Same project update to same db should succeed (already linked). So unlink first then
      // we need a second project. Skip if only one project — use SQL uniqueness by linking
      // then trying to set same db from a fake flow: after unlink and re-link used, second
      // concurrent assign of same used from allocate while another holds it.
      // Simpler: after current project holds `used`, create conflict by calling allocate logic
      // via POST link_db redis_db=used while already linked — that UPDATEs same row so OK.
      // Test: unlink, link db X, then use platformQuery uniqueness with a raw second insert —
      // For API-level: list projects and if 2+, use second.
      const projects = await api("GET", "http://localhost:3000/api/platform/projects")
      const others = (projects.json?.projects || projects.json || []).filter?.(
        (p) => p.id && p.id !== projectId
      )
      const list = Array.isArray(projects.json)
        ? projects.json
        : projects.json?.projects || []
      const other = list.find((p) => p.id !== projectId)
      if (!other) {
        // restore link
        await api("POST", base, { action: "link_db" })
        pass("14 duplicate DB conflict (skip)", "need 2 projects to test unique index")
      } else {
        const otherBase = `http://localhost:3000/api/platform/projects/${other.id}/redis`
        await api("DELETE", otherBase)
        const held = (await api("GET", base)).json?.link?.db
        const c = await api("POST", otherBase, { action: "link_db", redis_db: held })
        if (c.status === 400) {
          pass("14 duplicate DB conflict", c.json?.error || "rejected")
        } else {
          fail("14 duplicate DB conflict", `expected 400 got ${c.status} ${c.text}`)
          await api("DELETE", otherBase)
        }
        // ensure original still linked
        const cur = await api("GET", base)
        if (!cur.json?.link?.linked) await api("POST", base, { action: "link_db" })
      }
    }
  }

  console.log("\n===== SUMMARY =====")
  const ok = results.filter((r) => r.ok).length
  const bad = results.filter((r) => !r.ok).length
  console.log(`Passed: ${ok}/${results.length}   Failed: ${bad}`)
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}`)
  }
  process.exit(bad ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
