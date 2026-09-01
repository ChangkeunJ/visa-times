// The read side, written once. The local server and the worker each hand in a
// query function; neither owns any SQL.
export type Q = (sql: string, args: unknown[]) => Promise<any[]>

export const coverage = (q: Q) =>
  q(`select (select count(*)::int from reading where to_at is null) open,
            (select count(*)::int from reading) readings,
            (select count(distinct subclass)::int from reading where to_at is null) subclasses,
            (select count(*)::int from run) runs,
            (select min(at)::text from run) since,
            (select max(at)::text from run) latest,
            (select max(updated)::text from reading where to_at is null) published`, [])

// What the department says today, worst percentile first so the slow ones lead.
export const now = (q: Q) =>
  q(`select r.subclass, coalesce(v.name, '') as name, r.stream, r.stream_text,
            r.p25, r.p50, r.p75, r.p90, r.d90, r.updated::text, r.end_at::text, r.from_at
       from reading r left join visa v using (subclass)
      where r.to_at is null
      order by r.d90 desc nulls last, r.subclass, r.stream`, [])

// Every reading a subclass has ever had, oldest first, so the line can be drawn.
export const history = (q: Q, subclass: string, stream: string | null) =>
  q(`select r.stream, r.stream_text, r.p50, r.p90, r.d50, r.d90,
            r.updated::text, r.end_at::text, r.from_at, r.to_at
       from reading r
      where r.subclass = $1 and ($2::text is null or r.stream = $2)
      order by r.from_at`, [subclass, stream])

// What moved, and by how much. A reading that only restates the department's
// own publication date is not a movement, so the days have to differ.
export const moves = (q: Q, days = 90, subclass: string | null = null) =>
  q(`with pair as (
       select r.subclass, r.stream, r.stream_text, r.from_at, r.p50, r.p90, r.d50, r.d90,
              lag(r.p50)  over w as was50, lag(r.p90)  over w as was90,
              lag(r.d50)  over w as wasd50, lag(r.d90) over w as wasd90
         from reading r
        window w as (partition by r.subclass, r.stream order by r.from_at))
     select p.*, coalesce(v.name, '') as name
       from pair p left join visa v using (subclass)
      where p.was90 is not null and (p.d90 is distinct from p.wasd90 or p.d50 is distinct from p.wasd50)
        and p.from_at > now() - ($1 || ' days')::interval
        and ($2::text is null or p.subclass = $2)
      order by p.from_at desc, abs(coalesce(p.d90, 0) - coalesce(p.wasd90, 0)) desc
      limit 200`, [days, subclass])

// The readings the department has quietly stopped updating.
export const stale = (q: Q, months = 6) =>
  q(`select r.subclass, coalesce(v.name, '') as name, r.stream_text, r.p50, r.p90, r.updated::text
       from reading r left join visa v using (subclass)
      where r.to_at is null and r.updated < (current_date - ($1 || ' months')::interval)
      order by r.updated`, [months])
