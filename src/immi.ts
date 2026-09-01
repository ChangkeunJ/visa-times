// Home Affairs publishes what a visa is taking right now and never publishes what
// it took before. The page reads the numbers out of a JSON endpoint behind
// SharePoint, and the endpoint answers a plain POST with no key and no cookie.
const GPT = 'https://immi.homeaffairs.gov.au/_layouts/15/api/GPT.aspx/GetVisaGlobalProcessingTime'
const LIST = 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing'
const UA = 'visa-times (github.com/ChangkeunJ/visa-times)'

export type Reading = {
  subclass: string
  stream: string
  stream_text: string
  p25: string
  p50: string
  p75: string
  p90: string
  d25: number | null
  d50: number | null
  d75: number | null
  d90: number | null
  updated: string | null
  end_at: string | null
}

// "8 Months", "14 Days", "Less than 1 Day", "Processing times are not available".
// A month is taken as thirty days because the source has no finer granularity;
// the department's own words are kept beside the number.
export function days(text: string): number | null {
  if (/^less than 1 day$/i.test(text)) return 0
  const m = /^(\d+)\s+(day|month|year)s?$/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]!.toLowerCase()
  return unit === 'day' ? n : unit === 'month' ? n * 30 : n * 365
}

// "04 August 2026" is the only date format the endpoint uses. Parsing it into a
// local Date and formatting it back in UTC moves it a day west of Greenwich, so
// the parts are read out directly.
const MONTHS = 'january february march april may june july august september october november december'.split(' ')

export function date(text: string): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text.trim())
  if (!m) return null
  const month = MONTHS.findIndex((x) => x.startsWith(m[2]!.toLowerCase().slice(0, 3)))
  if (month < 0) return null
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
}

async function post(codes: string[]): Promise<any[]> {
  const r = await fetch(GPT, {
    method: 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/json; charset=utf-8', accept: 'application/json' },
    body: JSON.stringify({ gptRequest: codes.map((c) => ({ VisaSubclassCode: c, StreamCode: '' })) }),
  })
  if (!r.ok) throw new Error(`the endpoint answered ${r.status}`)
  const j: any = await r.json()
  if (!j?.d?.success) throw new Error(`the endpoint refused: ${JSON.stringify(j?.d?.data ?? j).slice(0, 200)}`)
  return j.d.data ?? []
}

export function reading(r: any): Reading {
  const [p25, p50, p75, p90] = [r.Percent25 ?? '', r.Percent50 ?? '', r.Percent75 ?? '', r.Percent90 ?? '']
  return {
    subclass: String(r.VisaSubclassCode),
    stream: String(r.StreamCode ?? ''),
    stream_text: String(r.StreamText ?? ''),
    p25, p50, p75, p90,
    d25: days(p25), d50: days(p50), d75: days(p75), d90: days(p90),
    updated: date(String(r.Updated ?? '')),
    end_at: date(String(r.EndDate ?? '')),
  }
}

// An empty stream code asks for every stream a subclass has, so the whole table
// is four hundred numbers behind seven requests.
export async function all(): Promise<Reading[]> {
  const codes = Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0'))
  const out: Reading[] = []
  for (let i = 0; i < codes.length; i += 150) {
    out.push(...(await post(codes.slice(i, i + 150))).map(reading))
    await new Promise((f) => setTimeout(f, 300))
  }
  const seen = new Set<string>()
  return out.filter((r) => !seen.has(`${r.subclass}\t${r.stream}`) && seen.add(`${r.subclass}\t${r.stream}`))
}

// The subclass code alone says nothing. The names sit in the navigation the
// visa listing page ships with, one title per subclass.
export function parseNames(html: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of html.matchAll(/"title":"([^"]*\(subclass (\d+)\)[^"]*)"/gi)) {
    const name = m[1]!.replace(/\s*\(subclass \d+\)/i, '').replace(/\s+/g, ' ').trim()
    if (name) out.set(m[2]!.padStart(3, '0'), name)
  }
  return out
}

export async function names(): Promise<Map<string, string>> {
  return parseNames(await (await fetch(LIST, { headers: { 'user-agent': UA } })).text())
}
