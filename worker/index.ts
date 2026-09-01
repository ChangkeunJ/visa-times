import { neon } from '@neondatabase/serverless'
import * as Q from '../src/queries'
import { atom } from '../src/feed'

interface Env {
  DATABASE_URL: string
  ASSETS: { fetch(req: Request): Promise<Response> }
}

const num = (v: string | null, or: number) => (v && Number.isFinite(Number(v)) ? Number(v) : or)

const routes: Record<string, (q: Q.Q, p: URLSearchParams) => Promise<unknown>> = {
  '/api/coverage': async (q) => (await Q.coverage(q))[0],
  '/api/now': (q) => Q.now(q),
  '/api/history': (q, p) => Q.history(q, p.get('subclass') ?? '', p.get('stream')),
  '/api/moves': (q, p) => Q.moves(q, num(p.get('days'), 90), p.get('subclass')),
  '/api/stale': (q, p) => Q.stale(q, num(p.get('months'), 6)),
}

// The files behind this move once a day at most.
const CACHE = 'public, max-age=900, s-maxage=3600'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': status === 200 ? CACHE : 'no-store',
    },
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url)
    const feed = /^\/feed(?:\/(\d{3}))?\.xml$/.exec(u.pathname)
    if (!feed && !u.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    const sql = neon(env.DATABASE_URL)
    const q: Q.Q = (text, args) => sql.query(text, args) as Promise<any[]>
    try {
      if (feed) {
        const rows = await Q.moves(q, 365, feed[1] ?? null)
        return new Response(atom(rows as any, u.toString()), {
          headers: { 'content-type': 'application/atom+xml; charset=utf-8', 'cache-control': CACHE },
        })
      }
      const fn = routes[u.pathname]
      if (!fn) return json({ error: 'not found', routes: [...Object.keys(routes), '/feed.xml', '/feed/{subclass}.xml'] }, 404)
      return json(await fn(q, u.searchParams))
    } catch (e: any) {
      return json({ error: String(e?.message ?? e) }, 500)
    }
  },
}
