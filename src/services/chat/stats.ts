import { formatDate } from '../../utils/format.js'
import type { ChatModel, MessageUsage } from '../api/types.js'
import { estimateCost } from '../pricing.js'
import * as db from './db.js'

const DAY = 86_400_000
const CHART_DAYS = 7

const MODEL_ORDER: ChatModel[] = ['deepseek-flash', 'deepseek-v4-pro']

export type ModelUsage = {
  model: ChatModel
  replies: number
  input: number
  cacheHit: number
  cacheCreate: number
  output: number
  tokens: number
  cost: number
}

export type DayUsage = {
  date: string
  /** 图表轴标签 M/D */
  label: string
  replies: number
  tokens: number
  cost: number
}

export type UsageStats = {
  sessions: number
  replies: number
  input: number
  cacheHit: number
  cacheCreate: number
  output: number
  tokens: number
  cost: number
  models: ModelUsage[]
  /** 最近 7 个自然日（含今天），没有用量的日期也保留 */
  days: DayUsage[]
}

const totalOf = (usage: MessageUsage) =>
  usage.input_tokens +
  usage.cache_creation_input_tokens +
  usage.cache_read_input_tokens +
  usage.output_tokens

const emptyModel = (model: ChatModel): ModelUsage => ({
  model,
  replies: 0,
  input: 0,
  cacheHit: 0,
  cacheCreate: 0,
  output: 0,
  tokens: 0,
  cost: 0,
})

/**
 * 聚合全部本地会话的用量：包含所有回答版本（重新生成、分支未选中的回答也真实计费）。
 * 费用按每条回复的创建时间判断高峰 / 闲时，使用官方人民币价目估算。
 */
export const loadUsageStats = async (): Promise<UsageStats> => {
  const sessions = await db.loadAllSessions()
  const models = new Map<ChatModel, ModelUsage>()
  const days = new Map<string, DayUsage>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let offset = CHART_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * DAY)
    const key = formatDate(date) ?? ''
    days.set(key, {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      replies: 0,
      tokens: 0,
      cost: 0,
    })
  }

  const stats: UsageStats = {
    sessions: sessions.length,
    replies: 0,
    input: 0,
    cacheHit: 0,
    cacheCreate: 0,
    output: 0,
    tokens: 0,
    cost: 0,
    models: [],
    days: [],
  }

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role !== 'assistant' || !message.usage) {
        continue
      }
      const usage = message.usage
      const model = message.model ?? 'deepseek-flash'
      const tokens = totalOf(usage)
      const cost = estimateCost(message.model, usage, new Date(message.createdAt))
      const modelUsage = models.get(model) ?? emptyModel(model)
      modelUsage.replies += 1
      modelUsage.input += usage.input_tokens
      modelUsage.cacheHit += usage.cache_read_input_tokens
      modelUsage.cacheCreate += usage.cache_creation_input_tokens
      modelUsage.output += usage.output_tokens
      modelUsage.tokens += tokens
      modelUsage.cost += cost
      models.set(model, modelUsage)
      stats.replies += 1
      stats.input += usage.input_tokens
      stats.cacheHit += usage.cache_read_input_tokens
      stats.cacheCreate += usage.cache_creation_input_tokens
      stats.output += usage.output_tokens
      stats.tokens += tokens
      stats.cost += cost
      const day = days.get(formatDate(message.createdAt) ?? '')
      if (day) {
        day.replies += 1
        day.tokens += tokens
        day.cost += cost
      }
    }
  }

  stats.models = MODEL_ORDER.flatMap((model) => {
    const usage = models.get(model)
    return usage && usage.replies > 0 ? [usage] : []
  })
  stats.days = [...days.values()]
  return stats
}
