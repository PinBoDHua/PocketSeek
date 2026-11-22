import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addOutboxEntry,
  clearOutbox,
  clearOutboxForSession,
  getOutboxEntry,
  hasSessionOutbox,
  removeOutboxEntry,
  sortedOutboxEntries,
  type OutboxEntry,
} from '../src/services/chat/outbox.ts'

const entry = (replyId: string, createdAt: number, sessionId = 's1'): OutboxEntry => ({
  sessionId,
  questionId: `q-${replyId}`,
  replyId,
  createdAt,
})

test('addOutboxEntry keeps one record per reply and preserves original time', () => {
  clearOutbox()
  addOutboxEntry(entry('r1', 100))
  addOutboxEntry(entry('r1', 999))
  assert.equal(sortedOutboxEntries().length, 1)
  assert.equal(getOutboxEntry('r1')?.createdAt, 100)
})

test('sortedOutboxEntries orders by createdAt ascending', () => {
  clearOutbox()
  addOutboxEntry(entry('r2', 200))
  addOutboxEntry(entry('r1', 100))
  addOutboxEntry(entry('r3', 300))
  assert.deepEqual(sortedOutboxEntries().map((e) => e.replyId), ['r1', 'r2', 'r3'])
})

test('removeOutboxEntry and hasSessionOutbox', () => {
  clearOutbox()
  addOutboxEntry(entry('r1', 100, 's1'))
  addOutboxEntry(entry('r2', 200, 's2'))
  assert.equal(hasSessionOutbox('s1'), true)
  removeOutboxEntry('r1')
  assert.equal(getOutboxEntry('r1'), undefined)
  assert.equal(hasSessionOutbox('s1'), false)
  assert.equal(hasSessionOutbox('s2'), true)
})

test('clearOutboxForSession only removes that session', () => {
  clearOutbox()
  addOutboxEntry(entry('r1', 100, 's1'))
  addOutboxEntry(entry('r2', 200, 's1'))
  addOutboxEntry(entry('r3', 300, 's2'))
  clearOutboxForSession('s1')
  assert.deepEqual(sortedOutboxEntries().map((e) => e.replyId), ['r3'])
})

test('clearOutbox empties the queue', () => {
  clearOutbox()
  addOutboxEntry(entry('r1', 100))
  clearOutbox()
  assert.equal(sortedOutboxEntries().length, 0)
})