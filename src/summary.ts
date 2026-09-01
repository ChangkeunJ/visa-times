import { writeFileSync, mkdirSync } from 'node:fs'
import { pool } from './db.js'
import { coverage, moves, now, stale } from './queries.js'

// Written into the repository after every run. It is the public record of what
// the department said that day, and it is what keeps GitHub from switching the
// schedule off after sixty quiet days.
async function main() {
  const db = pool()
  const q = async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows
  const [c] = await coverage(q)
  const day = new Date().toISOString().slice(0, 10)
  const rows = await now(q)

  const out = {
    date: day,
    coverage: c,
    slowest: rows.slice(0, 5).map((r) => ({ subclass: r.subclass, name: r.name, stream: r.stream_text, p50: r.p50, p90: r.p90 })),
    moved: (await moves(q, 30)).map((m) => ({
      subclass: m.subclass, name: m.name, stream: m.stream_text,
      p50: [m.was50, m.p50], p90: [m.was90, m.p90], at: m.from_at,
    })),
    stopped: (await stale(q, 6)).map((s) => ({ subclass: s.subclass, name: s.name, updated: s.updated })),
  }

  mkdirSync('data', { recursive: true })
  writeFileSync(`data/${day}.json`, JSON.stringify(out, null, 1) + '\n')
  writeFileSync('data/latest.json', JSON.stringify(out, null, 1) + '\n')
  console.log(`${day}: ${c.open} readings, ${out.moved.length} moved in the last month`)
  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
