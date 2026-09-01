# visa-times

The Department of Home Affairs publishes how long each Australian visa is taking
right now, and republishes it over the top about once a month. What a visa took
last month is not kept anywhere. This reads the department's own numbers once a
day and keeps every reading with the dates it held.

    https://visa-times.pages.dev

## Where the numbers come from

The processing times page is a SharePoint page, and the numbers are not in the
HTML it serves. A small script on the page, `app.gpt.js`, posts to an endpoint
behind it, and the endpoint answers a plain POST with no key, no cookie and no
captcha:

    POST /_layouts/15/api/GPT.aspx/GetVisaGlobalProcessingTime
    {"gptRequest":[{"VisaSubclassCode":"189","StreamCode":""}]}

    {"d":{"success":true,"data":[
      {"VisaSubclassCode":"189","StreamCode":"63","StreamText":"Points-Tested",
       "Percent25":"6 Months","Percent50":"7 Months",
       "Percent75":"8 Months","Percent90":"9 Months",
       "Updated":"04 August 2026","EndDate":"30 June 2026"}]}}

It hands over more than the page shows: the twenty-fifth and seventy-fifth
percentiles as well as the two the page prints. An empty `StreamCode` asks for
every stream a subclass has, so the whole table is 95 rows behind seven requests
and about four seconds.

Do not read the page instead. Akamai serves a generic cached shell to anything
that is not a real browser — the 417 page and the 189 page come back as the same
1.27 MB of navigation — and it turns a headless browser away with a 403. The
endpoint is not guarded at all. Scraping the page would quietly produce nothing
while looking like it worked.

Visa names are not in the endpoint. They are in the navigation the visa listing
page ships with, one title per subclass, which is the one thing the cached shell
is good for.

## What is kept

A reading that says the same thing as the open one is not written. Anything else
closes the open row and opens a new one, so `reading` is a set of intervals and
the question "what did it say on this date" has an answer. The feed is that pair:
the row that closed and the row that opened.

Two things bit while building it and are now tests. `new Date("04 August 2026")`
in a timezone east of Greenwich, formatted back through `toISOString`, lands on
3 August — which showed up as every reading changing on every run. And a `date`
column comes back from the driver as a `Date` at local midnight, so it never
equals the string that was written; the driver is told to leave dates alone.

## Being told

There is no account, no address to hand over and no mail to deliver. Movements
go out as Atom:

    /feed.xml           every movement
    /feed/189.xml       one subclass, every stream it has

## Running it locally

    docker compose up -d
    export DATABASE_URL=postgres://visa:visa@localhost:5434/visa
    npm ci && psql "$DATABASE_URL" -f schema.sql
    npm run read
    npm test
    npm run serve

    curl 'localhost:8080/api/now'
    curl 'localhost:8080/api/history?subclass=189&stream=63'
    curl 'localhost:8080/api/moves?days=365'
    curl 'localhost:8080/api/stale?months=6'
    curl 'localhost:8080/feed.xml'

The site is those endpoints and a page over them. `npm run web` serves the page,
`npm run api` runs the worker under it, and `npm run deploy` builds both.

## Layout

    src/immi.ts    the endpoint, the enumeration, and the parsing
    src/db.ts      the interval store
    src/queries.ts the read side's SQL, written once
    src/feed.ts    Atom, and the sentence each movement becomes
    src/read.ts    the daily read
    src/api.ts     local server over it
    worker/        the same routes on Cloudflare
    web/           the page
    test/          the parsing, the intervals, and the feed

## What is missing

The department publishes a single current snapshot, so the history here starts
the day this started reading and not a day earlier. Nothing can recover what it
said before that.

A month is taken as thirty days for ordering and for the chart. The source has no
finer granularity, and the department's own words are kept beside the number.

Some readings on the page have not been republished in years — one says August
2023 — and nothing on the page says so. They are listed separately here rather
than mixed in.

## Licence

MIT. The figures are published by the Department of Home Affairs. This is not
affiliated with the department, it is not immigration assistance, and nothing
here is advice about a particular application.
