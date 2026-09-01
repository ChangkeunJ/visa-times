import { Fragment, useEffect, useMemo, useState } from 'react'

type Cover = { open: number; readings: number; subclasses: number; runs: number; since: string; latest: string; published: string }
type Row = {
  subclass: string; name: string; stream: string; stream_text: string
  p25: string; p50: string; p75: string; p90: string; d90: number | null
  updated: string; end_at: string; from_at: string
}
type Hist = { stream: string; stream_text: string; p50: string; p90: string; d50: number | null; d90: number | null; updated: string; from_at: string; to_at: string | null }
type Move = { subclass: string; name: string; stream_text: string; p50: string; p90: string; was50: string; was90: string; from_at: string }
type Stale = { subclass: string; name: string; stream_text: string; p50: string; p90: string; updated: string }

function useJson<T>(url: string | null) {
  const [v, setV] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!url) {
      setV(null)
      return
    }
    const ac = new AbortController()
    setV(null)
    setErr(null)
    fetch(url, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then(setV, (e) => e.name !== 'AbortError' && setErr(String(e.message)))
    return () => ac.abort()
  }, [url])
  return { v, err }
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
const NA = 'Processing times are not available'
const said = (s: string) => (s === NA ? 'not published' : s)
const who = (r: { name: string; subclass: string; stream_text: string }) =>
  [r.name || `Subclass ${r.subclass}`, r.stream_text].filter(Boolean).join(' · ')

// The department rounds to whole months, so a line through the readings is a
// staircase rather than a curve.
function Line({ d }: { d: Hist[] }) {
  const pts = d.filter((p) => p.d90 !== null)
  if (pts.length < 2) return null
  const w = 720
  const h = 180
  const pad = 34
  const hi = Math.max(...pts.map((p) => p.d90!)) * 1.12
  const t0 = Date.parse(pts[0]!.from_at)
  const t1 = Date.now()
  const x = (iso: string) => pad + ((Date.parse(iso) - t0) / Math.max(t1 - t0, 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - (v / hi) * (h - pad * 2)
  let path = ''
  for (const [i, p] of pts.entries()) {
    const nx = i + 1 < pts.length ? x(pts[i + 1]!.from_at) : w - pad
    path += `${i ? 'L' : 'M'} ${x(p.from_at).toFixed(1)} ${y(p.d90!).toFixed(1)} L ${nx.toFixed(1)} ${y(p.d90!).toFixed(1)} `
  }
  const last = pts[pts.length - 1]!
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="ninety per cent processing time over time">
      <line x1={pad} y1={y(0)} x2={w - pad} y2={y(0)} className="axis" />
      <path d={path} className="line" />
      <text x={pad} y={y(0) + 15} className="lab">{day(pts[0]!.from_at)}</text>
      <text x={w - pad} y={y(0) + 15} className="lab end">today</text>
      <text x={w - pad} y={y(last.d90!) - 9} className="lab end strong">{last.p90}</text>
    </svg>
  )
}

function Detail({ r }: { r: Row }) {
  const { v } = useJson<Hist[]>(`/api/history?subclass=${r.subclass}&stream=${encodeURIComponent(r.stream)}`)
  return (
    <div className="detail" role="region" aria-label="visa processing detail">
      <div className="quart">
        {([['25%', r.p25], ['Half', r.p50], ['75%', r.p75], ['90%', r.p90]] as const).map(([k, val]) => (
          <div key={k}>
            <span className="k">{k} of applications</span>
            <span className="figure">{said(val)}</span>
          </div>
        ))}
      </div>
      <p className="note">
        The department's figures for applications finalised in the year to {day(r.end_at)}, last published{' '}
        {day(r.updated)}. Read here every day since {day(r.from_at)}.
      </p>
      {v && v.length > 1 ? <Line d={v} /> : <p className="note">One reading so far. The line starts when the first number moves.</p>}
      <p className="note">
        <a href={`/feed/${r.subclass}.xml`}>Feed for this visa</a> — subscribe and the movement arrives without an
        account or an address.
      </p>
    </div>
  )
}

function Now({ q }: { q: string }) {
  const { v, err } = useJson<Row[]>('/api/now')
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (v ?? []).filter((r) => !s || r.subclass.includes(s) || r.name.toLowerCase().includes(s) || r.stream_text.toLowerCase().includes(s))
  }, [v, q])

  if (err) return <p className="err">{err}</p>
  if (!v) return <p className="empty">Reading.</p>
  if (!rows.length) return <p className="empty">No visa matches that. Try a subclass number, or part of a name.</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Visa</th>
          <th className="r">Half are done in</th>
          <th className="r">Nine in ten</th>
          <th className="r">Published</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const id = `${r.subclass}/${r.stream}`
          return (
            <Fragment key={id}>
              <tr tabIndex={0} className={open === id ? 'on' : ''}
                  onClick={() => setOpen(open === id ? null : id)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(open === id ? null : id)}>
                <td className="name">{r.name || `Subclass ${r.subclass}`}<em>{[`subclass ${r.subclass}`, r.stream_text].filter(Boolean).join(' · ')}</em></td>
                <td className="r strong">{said(r.p50)}</td>
                <td className="r">{said(r.p90)}</td>
                <td className="r dim">{day(r.updated)}</td>
              </tr>
              {open === id && <tr><td colSpan={4}><Detail r={r} /></td></tr>}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function Moves() {
  const { v } = useJson<Move[]>('/api/moves?days=365')
  if (!v) return null
  if (!v.length)
    return (
      <p className="empty">
        Nothing has moved since this started reading. That is the honest state of a ledger on its first days, and it is
        the reason the ledger exists: the department overwrites the number and keeps no record of what it was.
      </p>
    )
  return (
    <table>
      <thead>
        <tr><th>Visa</th><th className="r">Was</th><th className="r">Now</th><th className="r">Seen</th></tr>
      </thead>
      <tbody>
        {v.map((m, i) => (
          <tr key={i}>
            <td className="name">{who(m)}</td>
            <td className="r dim">{said(m.was90)}</td>
            <td className="r strong">{said(m.p90)}</td>
            <td className="r dim">{day(m.from_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Stopped() {
  const { v } = useJson<Stale[]>('/api/stale?months=6')
  if (!v?.length) return null
  return (
    <section>
      <div className="bar">
        <h2>Quietly stopped</h2>
        <p className="note">
          Readings the department has not republished in six months. They still sit on the page beside the current
          ones, with nothing to say they are old.
        </p>
      </div>
      <table>
        <thead><tr><th>Visa</th><th className="r">Says</th><th className="r">Last published</th></tr></thead>
        <tbody>
          {v.map((s, i) => (
            <tr key={i}>
              <td className="name">{who(s)}</td>
              <td className="r">{said(s.p90)}</td>
              <td className="r dim">{day(s.updated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function App() {
  const [q, setQ] = useState('')
  const { v: c } = useJson<Cover>('/api/coverage')

  return (
    <>
      <header>
        <div className="wrap">
          <h1>visa times</h1>
          <p className="thesis">
            Home Affairs publishes how long a visa is taking right now, and republishes it over the top each month.
            What it took last month is not kept anywhere. This reads the department's own numbers once a day and keeps
            each one with the dates it held.
          </p>
          {c && (
            <p className="cover">
              {c.open} readings across {c.subclasses} visa subclasses, the department's figures as published{' '}
              {day(c.published)}, read here {c.runs === 1 ? 'once' : `${c.runs} times`} since {day(c.since)}.
            </p>
          )}
        </div>
      </header>

      <main className="wrap">
        <form className="find" onSubmit={(e) => e.preventDefault()}>
          <div className="find-box">
            <label htmlFor="q">Visa</label>
            <input id="q" value={q} autoComplete="off" placeholder="189, partner, student"
                   onChange={(e) => setQ(e.target.value)} />
          </div>
        </form>
        <Now q={q} />
      </main>

      <div className="wrap">
        <section>
          <div className="bar">
            <h2>What moved</h2>
            <p className="note">Every change since this started reading, newest first.</p>
          </div>
          <Moves />
        </section>
        <Stopped />
        <section>
          <div className="bar">
            <h2>Being told</h2>
            <p className="note">
              There is no account here and nothing to sign up to. <a href="/feed.xml">One feed carries every
              movement</a>, and each visa has its own at <code>/feed/189.xml</code>. Point a reader at it, or anything
              that reads a feed, and the change arrives when it happens.
            </p>
          </div>
        </section>
      </div>

      <footer className="wrap">
        <p>
          Figures from the Department of Home Affairs global visa processing times, read from the endpoint its own page
          reads. They describe applications already finalised, not a promise about yours, and the department says so.
          This is not immigration assistance and nothing here is advice about a particular application.{' '}
          <a href="https://github.com/ChangkeunJ/visa-times">Code</a>.
        </p>
      </footer>
    </>
  )
}
