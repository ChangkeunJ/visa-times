import { createServer } from 'node:http'
import { pool } from './db.js'
import * as Q from './queries.js'
import { atom } from './feed.js'

const db = pool()
const PORT = Number(process.env.PORT ?? 8080)
const q = async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows
const num = (v: string | null, or: number) => (v && Number.isFinite(Number(v)) ? Number(v) : or)

const routes: Record<string, (p: URLSearchParams) => Promise<unknown>> = {
  '/api/coverage': async () => (await Q.coverage(q))[0],
  '/api/now': () => Q.now(q),
  '/api/history': (p) => Q.history(q, p.get('subclass') ?? '', p.get('stream')),
  '/api/moves': (p) => Q.moves(q, num(p.get('days'), 90), p.get('subclass')),
  '/api/stale': (p) => Q.stale(q, num(p.get('months'), 6)),
}

createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://x')
  const feed = /^\/feed(?:\/(\d{3}))?\.xml$/.exec(u.pathname)
  try {
    if (feed) {
      const rows = await Q.moves(q, 365, feed[1] ?? null)
      res.setHeader('content-type', 'application/atom+xml; charset=utf-8')
      res.end(atom(rows as any, `http://localhost:${PORT}${u.pathname}`))
      return
    }
    const fn = routes[u.pathname]
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('access-control-allow-origin', '*')
    if (!fn) {
      res.writeHead(404).end(JSON.stringify({ error: 'not found', routes: Object.keys(routes) }))
      return
    }
    res.end(JSON.stringify(await fn(u.searchParams), null, 1))
  } catch (e: any) {
    res.writeHead(500).end(JSON.stringify({ error: String(e.message ?? e) }))
  }
}).listen(PORT, () => console.log(`listening on ${PORT}`))
