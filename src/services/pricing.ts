import type { ChatModel, MessageUsage } from './api/types.js'

type PricePerMillion = { cacheHit: number; cacheMiss: number; output: number }

/**
 * 官方定价页的人民币价目（每百万 token）。
 * 闲时价与高峰价各一份；高峰为北京时间周一至周五 9:00-12:00、14:00-18:00。
 */
const PRICES: Record<ChatModel, Record<'offPeak' | 'peak', PricePerMillion>> = {
  'deepseek-flash': {
    offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
    peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
  },
  'deepseek-v4-pro': {
    offPeak: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 },
    peak: { cacheHit: 0.3, cacheMiss: 9, output: 27 },
  },
}

/** 高峰时段按 UTC 判断：01:00-04:00 与 06:00-10:00，周一至周五 */
export const isPeakTime = (at: Date): boolean => {
  const day = at.getUTCDay()
  if (day === 0 || day === 6) {
    return false
  }
  const hour = at.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

/** 按官方价目估算本次回复费用（人民币）。缓存写入按未命中价计。 */
export const estimateCost = (
  model: ChatModel | null,
  usage: MessageUsage,
  at: Date = new Date()
): number => {
  const price = PRICES[model ?? 'deepseek-flash'][isPeakTime(at) ? 'peak' : 'offPeak']
  const tokens =
    (usage.input_tokens + usage.cache_creation_input_tokens) * price.cacheMiss +
    usage.cache_read_input_tokens * price.cacheHit +
    usage.output_tokens * price.output
  return tokens / 1_000_000
}

/** 费用展示：小额保留 4 位小数，其余 3 位，去掉多余的 0 */
export const formatCost = (cost: number): string => {
  const fixed = cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

/** token 数展示：超过 100 万用 M，超过 1000 用 K */
export const formatTokens = (count: number): string => {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count)
}
