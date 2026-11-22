import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sessionMarkdownFileName,
  sessionToMarkdown,
} from '../src/services/chat/markdownExport.ts'
import { normalizeSession } from '../src/services/chat/branches.ts'
import type { AssistantMessage, Session, UserMessage } from '../src/services/chat/types.ts'

const user = (id: string, content: string): UserMessage => ({
  id,
  role: 'user',
  content,
  files: [],
  createdAt: 0,
})

const assistant = (id: string, text: string): AssistantMessage => ({
  id,
  role: 'assistant',
  createdAt: 0,
  model: null,
  prefix: false,
  status: 'done',
  blocks: [{ type: 'text', text }],
})

const session = (title: string, messages: Session['messages']): Session =>
  normalizeSession({ id: 's', title, createdAt: 0, updatedAt: 0, messages })

test('sessionToMarkdown exports current branch with roles and round count', () => {
  const md = sessionToMarkdown(session('测试对话', [user('u1', '你好'), assistant('a1', '回答内容')]))
  assert.ok(md.startsWith('# 测试对话'))
  assert.ok(md.includes('共 1 轮对话'))
  assert.ok(md.includes('**我**'))
  assert.ok(md.includes('你好'))
  assert.ok(md.includes('**助手**'))
  assert.ok(md.includes('回答内容'))
})

test('sessionToMarkdown rewrites citation markers to numbered links', () => {
  const md = sessionToMarkdown(
    session('引用', [user('u1', 'q'), assistant('a1', '结论[citation:1]')])
  )
  assert.ok(md.includes('结论[1]'))
  assert.ok(!md.includes('[citation:1]'))
})

test('sessionToMarkdown only exports the selected branch', () => {
  const s: Session = {
    id: 's',
    title: '分支',
    createdAt: 0,
    updatedAt: 0,
    rootMessageId: 'u1',
    messages: [
      { ...user('u1', '问题'), selectedChildId: 'a2' },
      { ...assistant('a1', '旧版本'), parentId: 'u1' },
      { ...assistant('a2', '新版本'), parentId: 'u1' },
    ],
  }
  const md = sessionToMarkdown(s)
  assert.ok(md.includes('新版本'))
  assert.ok(!md.includes('旧版本'))
})

test('sessionMarkdownFileName sanitizes illegal characters and caps length', () => {
  const name = sessionMarkdownFileName(session('a/b:c*d?e', [user('u1', 'q')]))
  assert.ok(name.startsWith('pocketseek-'))
  assert.ok(name.endsWith('.md'))
  assert.ok(!/[\\/:*?"<>|]/.test(name))
  const long = sessionMarkdownFileName(session('长'.repeat(100), [user('u1', 'q')]))
  // 标题部分截断到 40 字符
  assert.ok(long.length <= 'pocketseek-'.length + 40 + '-YYYY-MM-DD.md'.length)
})