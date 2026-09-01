import { pool, put, putNames } from './db.js'
import { all, names } from './immi.js'

async function main() {
  const db = pool()
  const rows = await all()
  if (rows.length < 40) throw new Error(`only ${rows.length} readings came back, the endpoint changed shape`)
  await putNames(db, await names())
  const r = await put(db, rows)
  console.log(`run ${r.id}: ${rows.length} readings, ${r.opened} opened, ${r.closed} closed`)
  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
