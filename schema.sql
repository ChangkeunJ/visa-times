-- Home Affairs publishes what a visa is taking right now. It publishes nothing
-- about what it was taking last month, and the numbers change without notice.
-- This keeps every reading with the dates it held, which is the whole point.

-- One row per run, whether or not anything moved.
create table if not exists run (
  id       serial primary key,
  at       timestamptz not null default now(),
  readings int not null,
  opened   int not null,
  closed   int not null
);

-- The name behind a subclass code, from the department's own visa listing.
create table if not exists visa (
  subclass text primary key,
  name     text not null
);

-- One row per reading, open until the department publishes a different one.
-- days is a month taken as thirty, for ordering and for the chart; the text is
-- what the department actually wrote.
create table if not exists reading (
  subclass    text not null,
  stream      text not null,
  stream_text text not null default '',
  p25 text not null, p50 text not null, p75 text not null, p90 text not null,
  d25 int, d50 int, d75 int, d90 int,
  updated     date,
  end_at      date,
  from_at     timestamptz not null,
  to_at       timestamptz,
  primary key (subclass, stream, from_at)
);
create index if not exists reading_open on reading (subclass, stream) where to_at is null;
create index if not exists reading_from on reading (from_at desc);
