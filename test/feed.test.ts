import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atom, title, type Move } from '../src/feed.js'

const move = (over: Partial<Move> = {}): Move => ({
  subclass: '189', name: 'Skilled Independent visa', stream_text: 'Points-Tested',
  p50: '7 Months', p90: '9 Months', was50: '7 Months', was90: '11 Months',
  from_at: '2026-09-01T00:00:00.000Z', ...over,
})

test('the title says who moved and which way', () => {
  assert.equal(title(move()),
    'Skilled Independent visa, Points-Tested (subclass 189): 90% now 9 Months, was 11 Months')
})

test('a subclass with no name and no stream still reads', () => {
  assert.equal(title(move({ name: '', stream_text: '', subclass: '417' })),
    'Subclass 417 (subclass 417): 90% now 9 Months, was 11 Months')
})

test('when only the middle moved the title says so', () => {
  assert.equal(title(move({ p90: '11 Months', p50: '8 Months' })),
    'Skilled Independent visa, Points-Tested (subclass 189): half now 8 Months, was 7 Months')
})

test('the feed is well formed and carries one entry a movement', () => {
  const x = atom([move(), move({ subclass: '417' })], 'https://x/feed.xml')
  assert.equal((x.match(/<entry>/g) ?? []).length, 2)
  assert.match(x, /<updated>2026-09-01T00:00:00\.000Z<\/updated>/)
  assert.match(x, /<link rel="self" href="https:\/\/x\/feed\.xml"\/>/)
})

test('an ampersand in a visa name does not break the xml', () => {
  const x = atom([move({ name: 'Skilled & Business' })], 'https://x/feed.xml?a=1&b=2')
  assert.match(x, /Skilled &amp; Business/)
  assert.match(x, /href="https:\/\/x\/feed\.xml\?a=1&amp;b=2"/)
  assert.equal(x.includes('& '), false)
})

test('an empty feed is still a feed', () => {
  const x = atom([], 'https://x/feed.xml')
  assert.match(x, /<feed xmlns/)
  assert.equal((x.match(/<entry>/g) ?? []).length, 0)
})
