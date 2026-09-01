import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool, put, putNames } from '../src/db.js'
import * as Q from '../src/queries.js'
import type { Reading } from '../src/immi.js'

const live = !!process.env.DATABASE_URL
const opts = live ? {} : { skip: 'DATABASE_URL not set' }
const db = live ? pool() : null
const q: Q.Q = async (sql, args) => (await db!.query(sql, args)).rows

// A subclass code the department will never issue, so the fixture is never mixed
// in with the real readings.
const ZZ = '000'

const row = (p50: string, p90: string, updated = '2026-08-04'): Reading => ({
  subclass: ZZ, stream: '', stream_text: 'Test',
  p25: p50, p50, p75: p90, p90,
  d25: null, d50: p50 === 'Processing times are not available' ? null : Number(p50.split(' ')[0]) * 30,
  d75: null, d90: p90 === 'Processing times are not available' ? null : Number(p90.split(' ')[0]) * 30,
  updated, end_at: '2026-06-30',
})

const clean = async () => {
  await db!.query('delete from reading where subclass = $1', [ZZ])
  await db!.query('delete from visa where subclass = $1', [ZZ])
}

before(async () => {
  if (!db) return
  await clean()
  await putNames(db, new Map([[ZZ, 'Test visa']]))
})

after(async () => {
  if (!db) return
  await clean()
  await db.end()
})

test('the first reading opens a row', opts, async () => {
  const r = await put(db!, [row('7 Months', '9 Months')])
  assert.equal(r.opened, 1)
  assert.equal(r.closed, 0)
})

test('the same reading again is not news', opts, async () => {
  const r = await put(db!, [row('7 Months', '9 Months')])
  assert.deepEqual([r.opened, r.closed], [0, 0])
})

test('a different reading closes the old row and opens a new one', opts, async () => {
  const r = await put(db!, [row('8 Months', '14 Months')])
  assert.deepEqual([r.opened, r.closed], [1, 1])
  const h = await Q.history(q, ZZ, null)
  assert.deepEqual(h.map((x: any) => x.p90), ['9 Months', '14 Months'])
  assert.equal(h[0].to_at !== null, true)
  assert.equal(h[1].to_at, null)
})

test('the movement carries what it moved from', opts, async () => {
  const m = (await Q.moves(q, 1)).filter((x: any) => x.subclass === ZZ)
  assert.equal(m.length, 1)
  assert.deepEqual([m[0].was90, m[0].p90, m[0].name], ['9 Months', '14 Months', 'Test visa'])
})

test('only the open reading is current', opts, async () => {
  const n = (await Q.now(q)).filter((x: any) => x.subclass === ZZ)
  assert.equal(n.length, 1)
  assert.equal(n[0].p90, '14 Months')
})

test('a reading the department stopped updating is called out', opts, async () => {
  await put(db!, [row('8 Months', '14 Months', '2024-01-31')])
  const s = (await Q.stale(q, 6)).filter((x: any) => x.subclass === ZZ)
  assert.equal(s.length, 1)
  assert.equal(s[0].updated, '2024-01-31')
})
