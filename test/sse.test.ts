import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ServerSentEventDecoder,
  ServerSentEventLimitError,
} from '../src/services/api/sse.ts'

test('decodes event name and multi-line data', () => {
  const decoder = new ServerSentEventDecoder()
  const events = decoder.push('event: delta\ndata: a\ndata: b\n\n')
  assert.deepEqual(events, [{ event: 'delta', data: 'a\nb', lastEventId: '' }])
})

test('handles CRLF split across chunks', () => {
  const decoder = new ServerSentEventDecoder()
  assert.deepEqual(decoder.push('data: hi\r'), [])
  assert.deepEqual(decoder.push('\n\r\n'), [
    { event: 'message', data: 'hi', lastEventId: '' },
  ])
})

test('ignores keep-alive comments', () => {
  const decoder = new ServerSentEventDecoder()
  assert.deepEqual(decoder.push(': keep-alive\n\n'), [])
})

test('rejects an oversized line', () => {
  const decoder = new ServerSentEventDecoder()
  assert.throws(() => decoder.push('x'.repeat(1_000_001)), ServerSentEventLimitError)
})

test('rejects an oversized event', () => {
  const decoder = new ServerSentEventDecoder()
  const chunk = `data: ${'x'.repeat(900_000)}\n`
  assert.throws(() => decoder.push(chunk.repeat(9)), ServerSentEventLimitError)
})