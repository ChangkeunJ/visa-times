import pg from 'pg'
import type { Reading } from './immi.js'

// A date is a day, not an instant. Left to the driver it comes back as a Date at
// local midnight and every comparison with a stored string is off by a timezone.
pg.types.setTypeParser(1082, (v) => v)

export type Pool = pg.Pool

export function pool(url = process.env.DATABASE_URL): Pool {
  if (!url) throw new Error('DATABASE_URL is not set')
  return new pg.Pool({ connectionString: url, max: 4 })
}

// The department's own publication date is part of what a reading says, so a
// republish that restates the same figures still closes the row and opens a new
// one. That is deliberate: knowing the department looked again and did not move
// the number is worth as much as knowing it moved. Movements are a narrower
// thing and queries.moves picks them out by comparing the days.
const SAME = ['p25', 'p50', 'p75', 'p90', 'updated', 'end_at', 'stream_text'] as const

const alike = (a: any, b: Reading) =>
  SAME.every((k) => String(a[k] ?? '') === String((b as any)[k] ?? ''))

export async function putNames(db: Pool, names: Map<string, string>) {
  for (const [subclass, name] of names) {
    await db.query(
      `insert into visa (subclass, name) values ($1, $2)
       on conflict (subclass) do update set name = excluded.name`, [subclass, name])
  }
}

// A reading that says the same thing as the open one is not news, so it is not
// written. Anything else closes the old row and opens a new one, and that pair
// is what the feed reports.
export async function put(db: Pool, rows: Reading[]) {
  const c = await db.connect()
  try {
    await c.query('begin')
    const { rows: open } = await c.query('select * from reading where to_at is null')
    const at = new Date()
    const by = new Map(open.map((r) => [`${r.subclass}\t${r.stream}`, r]))
    let opened = 0
    let closed = 0
    for (const r of rows) {
      const was = by.get(`${r.subclass}\t${r.stream}`)
      if (was && alike(was, r)) continue
      if (was) {
        await c.query('update reading set to_at = $1 where subclass = $2 and stream = $3 and to_at is null',
          [at, r.subclass, r.stream])
        closed++
      }
      await c.query(
        `insert into reading (subclass, stream, stream_text, p25, p50, p75, p90, d25, d50, d75, d90, updated, end_at, from_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict do nothing`,
        [r.subclass, r.stream, r.stream_text, r.p25, r.p50, r.p75, r.p90,
         r.d25, r.d50, r.d75, r.d90, r.updated, r.end_at, at])
      opened++
    }
    const { rows: run } = await c.query(
      'insert into run (readings, opened, closed) values ($1,$2,$3) returning id', [rows.length, opened, closed])
    await c.query('commit')
    return { id: run[0].id as number, opened, closed }
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    c.release()
  }
}
