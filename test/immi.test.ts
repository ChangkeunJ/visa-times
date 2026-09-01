import { test } from 'node:test'
import assert from 'node:assert/strict'
import { date, days, parseNames, reading } from '../src/immi.js'

test('a duration is read in whatever unit the department used', () => {
  assert.equal(days('14 Days'), 14)
  assert.equal(days('8 Months'), 240)
  assert.equal(days('2 Years'), 730)
  assert.equal(days('1 Day'), 1)
})

test('the two sentences that are not durations', () => {
  assert.equal(days('Less than 1 Day'), 0)
  assert.equal(days('Processing times are not available'), null)
  assert.equal(days(''), null)
})

// Parsing the date into a local Date and formatting it back in UTC moved it a
// day west, which showed up as every reading changing on every run.
test('a date does not move a day when the clock is east of Greenwich', () => {
  assert.equal(date('04 August 2026'), '2026-08-04')
  assert.equal(date('1 January 2026'), '2026-01-01')
  assert.equal(date('31 December 2025'), '2025-12-31')
  assert.equal(date('not a date'), null)
})

test('a row comes back with the words and the days beside them', () => {
  const r = reading({
    VisaSubclassCode: 189, StreamCode: '63', StreamText: 'Points-Tested',
    Percent25: '6 Months', Percent50: '7 Months', Percent75: '8 Months', Percent90: '9 Months',
    Updated: '04 August 2026', EndDate: '30 June 2026',
  })
  assert.deepEqual([r.subclass, r.stream, r.p90, r.d90, r.updated, r.end_at],
    ['189', '63', '9 Months', 270, '2026-08-04', '2026-06-30'])
})

test('a subclass with no stream keeps an empty stream rather than a null', () => {
  const r = reading({ VisaSubclassCode: '417', Percent25: '', Percent50: '', Percent75: '', Percent90: '' })
  assert.deepEqual([r.stream, r.stream_text, r.d50], ['', '', null])
})

test('the visa names come out of the navigation the listing page ships with', () => {
  const html = '{"title":"Working Holiday visa (subclass 417)","x":1},{"title":"Skilled Independent visa (subclass 189) (Points-tested)"},{"title":"Visa processing times"}'
  const n = parseNames(html)
  assert.equal(n.size, 2)
  assert.equal(n.get('417'), 'Working Holiday visa')
  assert.equal(n.get('189'), 'Skilled Independent visa (Points-tested)')
})
