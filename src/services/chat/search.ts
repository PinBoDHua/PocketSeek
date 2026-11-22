import { translate } from '../../i18n/index.js'
import { getVisibleMessages } from './branches.js'
import * as db from './db.js'
import type { Message } from './types.js'

/** 标题命中与消息正文命中的上限，避免超长历史一次返回过多结果 */
const TITLE_LIMIT = 30
const MESSAGE_LIMIT = 40

type SearchHitBase = {
  sessionId: string
  /** 会话标题，未命名时用「新对话」 */
  title: string
  createdAt: number
  updatedAt: number
}

export type TitleHit = SearchHitBase & { kind: 'title' }

export type MessageHit = SearchHitBase & {
  kind: 'message'
  messageId: string
  role: 'user' | 'assistant'
  /** 关键词前后的上下文；首尾有省略号表示被截断 */
  snippet: string
  /** 命中消息的创建时间 */
  messageCreatedAt: number
}

export type SearchResult = {
  titles: TitleHit[]
  messages: MessageHit[]
  /** 命中数超过上限时为 true，提示只展示了一部分 */
  truncated: boolean
}

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim()

/** 摘要展示去掉 Markdown 标记，避免搜索结果里出现 `**`、围栏等原始符号 */
const readable = (text: string) =>
  text
    .replace(/```[\w-]*\s*/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[citation:\d+\]/g, '')
    .replace(/(\*\*|__|~~)/g, '')
    .replace(/(^|\n)\s*#{1,6}\s*/g, '$1')
    .replace(/(^|\n)\s*[-*+]\s+/g, '$1')
    .replace(/(^|\n)\s*>\s?/g, '$1')

/** 消息的可见文字：用户提问正文，或助手回答里的正文块（模板提示与思考不参与搜索） */
const messageText = (message: Message): string => {
  if (message.role === 'user') {
    return message.content
  }
  return message.blocks
    .flatMap((block) => (block.type === 'text' && !block.isTemplate ? [block.text] : []))
    .join('\n\n')
}

const makeSnippet = (text: string, keyword: string): string | null => {
  const compact = collapse(readable(text))
  const index = compact.toLowerCase().indexOf(keyword)
  if (index < 0) {
    return null
  }
  const start = Math.max(0, index - 30)
  const end = Math.min(compact.length, index + keyword.length + 48)
  return `${start > 0 ? '…' : ''}${compact.slice(start, end)}${end < compact.length ? '…' : ''}`
}

/**
 * 在全部本地会话中搜索：先匹配标题，再按会话更新时间从新到旧扫描可见分支的消息正文。
 * 只读当前展示的分支；分支里未选中的回答不会出现在结果中。
 */
const YIELD_EVERY = 25
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export const searchAllSessions = async (
  query: string,
  signal?: AbortSignal
): Promise<SearchResult> => {
  const keyword = query.trim().toLowerCase()
  const result: SearchResult = { titles: [], messages: [], truncated: false }
  if (!keyword) {
    return result
  }
  const sessions = (await db.loadAllSessions()).sort((a, b) => b.updatedAt - a.updatedAt)
  let processed = 0
  for (const session of sessions) {
    if (signal?.aborted) {
      return result
    }
    processed += 1
    if (processed % YIELD_EVERY === 0) {
      await yieldToMain()
    }
    const title = session.title || translate('untitledChat')
    if (title.toLowerCase().includes(keyword)) {
      if (result.titles.length >= TITLE_LIMIT) {
        result.truncated = true
        break
      }
      result.titles.push({
        kind: 'title',
        sessionId: session.id,
        title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })
    }
  }
  scan: for (const session of sessions) {
    if (signal?.aborted) {
      return result
    }
    processed += 1
    if (processed % YIELD_EVERY === 0) {
      await yieldToMain()
    }
    const title = session.title || translate('untitledChat')
    for (const message of getVisibleMessages(session)) {
      const snippet = makeSnippet(messageText(message), keyword)
      if (!snippet) {
        continue
      }
      if (result.messages.length >= MESSAGE_LIMIT) {
        result.truncated = true
        break scan
      }
      result.messages.push({
        kind: 'message',
        sessionId: session.id,
        title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageId: message.id,
        role: message.role,
        snippet,
        messageCreatedAt: message.createdAt,
      })
    }
  }
  return result
}
