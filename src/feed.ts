// The alert channel. No account, no address to hand over, no mail to deliver:
// a reader subscribes to the feed and the movements arrive.
export type Move = {
  subclass: string
  name: string
  stream_text: string
  p50: string
  p90: string
  was50: string
  was90: string
  from_at: string | Date
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const iso = (v: string | Date) => (v instanceof Date ? v : new Date(v)).toISOString()

export function title(m: Move): string {
  const who = [m.name || `Subclass ${m.subclass}`, m.stream_text].filter(Boolean).join(', ')
  const moved = m.p90 !== m.was90 ? `90% now ${m.p90}, was ${m.was90}` : `half now ${m.p50}, was ${m.was50}`
  return `${who} (subclass ${m.subclass}): ${moved}`
}

export function atom(moves: Move[], self: string, name = 'visa times'): string {
  const at = moves[0] ? iso(moves[0].from_at) : new Date(0).toISOString()
  const entries = moves.map((m) => `  <entry>
    <title>${esc(title(m))}</title>
    <id>tag:visa-times,${iso(m.from_at).slice(0, 10)}:${m.subclass}/${esc(m.stream_text)}/${iso(m.from_at)}</id>
    <updated>${iso(m.from_at)}</updated>
    <link href="${esc(self.replace(/\/feed.*$/, ''))}/#${m.subclass}"/>
    <summary>Half of applications: ${esc(m.p50)}, was ${esc(m.was50)}. Ninety per cent: ${esc(m.p90)}, was ${esc(m.was90)}. These are the department's own figures, read once a day.</summary>
  </entry>`).join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(name)}</title>
  <id>${esc(self)}</id>
  <link rel="self" href="${esc(self)}"/>
  <updated>${at}</updated>
${entries}
</feed>
`
}
