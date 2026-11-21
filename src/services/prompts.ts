import { create } from 'zustand'
import { createId } from '../utils/id.js'

export type Prompt = {
  id: string
  title: string
  content: string
  updatedAt: number
}

export const PROMPT_TITLE_MAX = 30
export const PROMPT_CONTENT_MAX = 4000
export const PROMPT_LIMIT = 50

const STORAGE_KEY = 'pocketseek:prompts'

/** 内置快捷提问：首次启动时写入，可自由编辑、删除或恢复 */
export const DEFAULT_PROMPTS: readonly Prompt[] = [
  {
    id: 'default-weekly-report',
    title: '本周工作周报',
    content:
      '请帮我写一份本周工作周报。本周的主要工作如下：\n1. \n2. \n3. \n\n请按「本周完成 / 进行中 / 下周计划 / 风险与需要的支持」四部分组织，语气简洁专业，重要事项写清结果。',
    updatedAt: 0,
  },
  {
    id: 'default-explain-code',
    title: '解释这段代码',
    content: '请解释下面这段代码的作用、关键执行流程和潜在问题，并给出改进建议：\n\n```\n\n```',
    updatedAt: 0,
  },
  {
    id: 'default-translate',
    title: '翻译成英文',
    content: '请把下面这段话翻译成地道的英文，保持原有语气与格式，只输出译文：\n\n',
    updatedAt: 0,
  },
  {
    id: 'default-summarize',
    title: '提炼文章要点',
    content: '请用要点总结下面这段内容的核心观点，并列出 3 条可执行的启发：\n\n',
    updatedAt: 0,
  },
]

const fallbackTitle = (content: string) => {
  const firstLine = content.trim().split('\n', 1)[0]?.trim() ?? ''
  return firstLine.slice(0, 14) || '未命名提示词'
}

const normalizeTitle = (title: unknown, content: string) =>
  typeof title === 'string' && title.trim()
    ? title.trim().slice(0, PROMPT_TITLE_MAX)
    : fallbackTitle(content)

const normalizePrompt = (value: unknown): Prompt | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id || typeof record.content !== 'string') {
    return null
  }
  const content = record.content.trim().slice(0, PROMPT_CONTENT_MAX)
  if (!content) {
    return null
  }
  return {
    id: record.id,
    title: normalizeTitle(record.title, content),
    content,
    updatedAt:
      typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : 0,
  }
}

/** 手改 localStorage 或旧数据不合法时按空库处理，不阻塞启动 */
const parsePrompts = (raw: string | null): Prompt[] | null => {
  if (raw === null) {
    return null
  }
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return null
    }
    const seen = new Set<string>()
    const prompts: Prompt[] = []
    for (const item of data) {
      const prompt = normalizePrompt(item)
      if (prompt && !seen.has(prompt.id)) {
        seen.add(prompt.id)
        prompts.push(prompt)
      }
      if (prompts.length >= PROMPT_LIMIT) {
        break
      }
    }
    return prompts
  } catch {
    return null
  }
}

const readPrompts = (): Prompt[] | null => {
  try {
    return parsePrompts(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

const initialPrompts = readPrompts()

export const usePrompts = create(() => ({
  prompts: initialPrompts ?? [...DEFAULT_PROMPTS],
}))

const save = (prompts: Prompt[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
  } catch {
    // 存储不可用时只在内存中生效
  }
  usePrompts.setState({ prompts })
}

export const canAddPrompt = () => usePrompts.getState().prompts.length < PROMPT_LIMIT

export const addPrompt = (title: string, content: string): Prompt | null => {
  const normalized = content.trim().slice(0, PROMPT_CONTENT_MAX)
  if (!normalized || !canAddPrompt()) {
    return null
  }
  const prompt: Prompt = {
    id: createId(),
    title: normalizeTitle(title, normalized),
    content: normalized,
    updatedAt: Date.now(),
  }
  save([prompt, ...usePrompts.getState().prompts])
  return prompt
}

export const updatePrompt = (id: string, title: string, content: string): boolean => {
  const normalized = content.trim().slice(0, PROMPT_CONTENT_MAX)
  const prompts = usePrompts.getState().prompts
  if (!normalized || !prompts.some((prompt) => prompt.id === id)) {
    return false
  }
  save(
    prompts.map((prompt) =>
      prompt.id === id
        ? {
            ...prompt,
            title: normalizeTitle(title, normalized),
            content: normalized,
            updatedAt: Date.now(),
          }
        : prompt
    )
  )
  return true
}

export const removePrompt = (id: string) => {
  save(usePrompts.getState().prompts.filter((prompt) => prompt.id !== id))
}

export const resetPrompts = () => {
  save([...DEFAULT_PROMPTS])
}
