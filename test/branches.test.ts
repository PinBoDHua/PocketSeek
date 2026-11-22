import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMessageVersions,
  getVisibleMessages,
  normalizeSession,
  removeLastTurn,
  selectVersion,
} from '../src/services/chat/branches.ts'
import type { AssistantMessage, Message, Session, UserMessage } from '../src/services/chat/types.ts'

const user = (id: string, over: Partial<UserMessage> = {}): UserMessage => ({
  id,
  role: 'user',
  content: `q-${id}`,
  files: [],
  createdAt: 0,
  ...over,
})

const assistant = (id: string, over: Partial<AssistantMessage> = {}): AssistantMessage => ({
  id,
  role: 'assistant',
  createdAt: 0,
  model: null,
  prefix: false,
  status: 'done',
  blocks: [],
  ...over,
})

const session = (messages: Message[], over: Partial<Session> = {}): Session => ({
  id: 's',
  title: 't',
  createdAt: 0,
  updatedAt: 0,
  messages,
  ...over,
})

test('normalizeSession turns a linear list into a branch chain', () => {
  const normalized = normalizeSession(session([user('u1'), assistant('a1'), user('u2'), assistant('a2')]))
  assert.equal(normalized.rootMessageId, 'u1')
  assert.equal(normalized.messages[0].parentId, null)
  assert.equal(normalized.messages[0].selectedChildId, 'a1')
  assert.equal(normalized.messages[1].parentId, 'u1')
  assert.equal(normalized.messages[2].parentId, 'a1')
})

test('getVisibleMessages follows the selected branch path', () => {
  const s = session(
    [
      user('u1', { selectedChildId: 'a2' }),
      assistant('a1', { parentId: 'u1' }),
      assistant('a2', { parentId: 'u1' }),
    ],
    { rootMessageId: 'u1' }
  )
  assert.deepEqual(getVisibleMessages(s).map((m) => m.id), ['u1', 'a2'])
})

test('buildMessageVersions groups siblings and reuses unchanged map', () => {
  const s = session(
    [
      user('u1', { selectedChildId: 'a1' }),
      assistant('a1', { parentId: 'u1' }),
      assistant('a2', { parentId: 'u1' }),
    ],
    { rootMessageId: 'u1' }
  )
  const first = buildMessageVersions(s, new Map())
  assert.deepEqual(first.get('a1'), { ids: ['a1', 'a2'], index: 0 })
  assert.deepEqual(first.get('a2'), { ids: ['a1', 'a2'], index: 1 })
  // 消息未变化时复用同一 Map 引用，避免流式更新重绘历史消息
  const second = buildMessageVersions(s, first)
  assert.equal(second, first)
})

test('selectVersion switches the selected sibling', () => {
  const s = session(
    [
      user('u1', { selectedChildId: 'a2' }),
      assistant('a1', { parentId: 'u1' }),
      assistant('a2', { parentId: 'u1' }),
    ],
    { rootMessageId: 'u1' }
  )
  const next = selectVersion(s, 'a1')
  assert.equal(next.messages.find((m) => m.id === 'u1')?.selectedChildId, 'a1')
  assert.deepEqual(getVisibleMessages(next).map((m) => m.id), ['u1', 'a1'])
})

test('removeLastTurn removes a sole last turn but keeps branched history', () => {
  const linear = normalizeSession(session([user('u1'), assistant('a1')]))
  const removed = removeLastTurn(linear, 'u1', 'a1')
  assert.ok(removed)
  assert.equal(removed.messages.length, 0)
  assert.equal(removed.rootMessageId, null)

  const branched = session(
    [
      user('u1', { selectedChildId: 'a1' }),
      assistant('a1', { parentId: 'u1' }),
      assistant('a2', { parentId: 'u1' }),
    ],
    { rootMessageId: 'u1' }
  )
  // 还有兄弟版本时不能删除，避免误删其他分支
  assert.equal(removeLastTurn(branched, 'u1', 'a1'), null)
})