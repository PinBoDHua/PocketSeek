import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { normalizeSession } from '../src/services/chat/branches.ts'
import type { Session } from '../src/services/chat/types.ts'

const sessions: Session[] = [
  normalizeSession({
    id: 's1',
    title: '旅行计划',
    createdAt: 0,
    updatedAt: 200,
    messages: [
      { id: 'u1', role: 'user', content: '想去哪里玩', files: [], createdAt: 0 },
      {
        id: 'a1',
        role: 'assistant',
        createdAt: 0,
        model: null,
        prefix: false,
        status: 'done',
        blocks: [{ type: 'text', text: '**云南**很美，推荐去大理' }],
      },
    ],
  }),
  normalizeSession({
    id: 's2',
    title: '代码笔记',
    createdAt: 0,
    updatedAt: 100,
    messages: [
      { id: 'u2', role: 'user', content: '解释闭包', files: [], createdAt: 0 },
      {
        id: 'a2',
        role: 'assistant',
        createdAt: 0,
        model: null,
        prefix: false,
        status: 'done',
        blocks: [{ type: 'text', text: 'React 闭包是函数与其词法环境的组合' }],
      },
    ],
  }),
]

mock.module('../src/services/chat/db.ts', {
  namedExports: {
    loadAllSessions: async () => sessions,
  },
})

const { searchAllSessions } = await import('../src/services/chat/search.ts')

test('empty query returns no results', async () => {
  const result = await searchAllSessions('   ')
  assert.deepEqual(result, { titles: [], messages: [], truncated: false })
})

test('matches session titles', async () => {
  const result = await searchAllSessions('旅行')
  assert.equal(result.titles.length, 1)
  assert.equal(result.titles[0].sessionId, 's1')
})

test('matches message body and strips markdown in snippet', async () => {
  const result = await searchAllSessions('云南')
  assert.equal(result.messages.length, 1)
  const hit = result.messages[0]
  assert.equal(hit.sessionId, 's1')
  assert.ok(hit.snippet.includes('云南很美'))
  assert.ok(!hit.snippet.includes('**'))
})

test('search is case insensitive', async () => {
  const result = await searchAllSessions('REACT')
  assert.equal(result.messages.length, 1)
  assert.equal(result.messages[0].sessionId, 's2')
  const none = await searchAllSessions('不存在的关键字')
  assert.deepEqual(none, { titles: [], messages: [], truncated: false })
})