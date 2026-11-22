import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateCost, formatCost, formatTokens, isPeakTime } from '../src/services/pricing.ts'

const usage = (over: Partial<Record<string, number>> = {}) => ({
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  ...over,
})

test('peak hours are weekday UTC 01-04 and 06-10', () => {
  // 2026-11-23 是周一
  assert.equal(isPeakTime(new Date('2026-11-23T01:00:00Z')), true)
  assert.equal(isPeakTime(new Date('2026-11-23T03:59:00Z')), true)
  assert.equal(isPeakTime(new Date('2026-11-23T06:00:00Z')), true)
  assert.equal(isPeakTime(new Date('2026-11-23T09:59:00Z')), true)
})

test('off-peak boundaries and weekends', () => {
  assert.equal(isPeakTime(new Date('2026-11-23T00:59:00Z')), false)
  assert.equal(isPeakTime(new Date('2026-11-23T04:00:00Z')), false)
  assert.equal(isPeakTime(new Date('2026-11-23T05:59:00Z')), false)
  assert.equal(isPeakTime(new Date('2026-11-23T10:00:00Z')), false)
  // 周日、周六即使处于时段内也是闲时
  assert.equal(isPeakTime(new Date('2026-11-22T07:00:00Z')), false)
  assert.equal(isPeakTime(new Date('2026-11-21T02:00:00Z')), false)
})

test('estimateCost uses per-million prices and peak multiplier', () => {
  const offPeak = new Date('2026-11-23T00:00:00Z')
  const peak = new Date('2026-11-23T07:00:00Z')
  const million = usage({ input_tokens: 1_000_000 })
  // Flash 闲时输入 ¥1/M，高峰翻倍
  assert.equal(estimateCost('deepseek-flash', million, offPeak), 1)
  assert.equal(estimateCost('deepseek-flash', million, peak), 2)
  // 输出 ¥4/M（闲时），缓存命中 ¥0.02/M
  assert.equal(estimateCost('deepseek-flash', usage({ output_tokens: 1_000_000 }), offPeak), 4)
  assert.equal(estimateCost('deepseek-flash', usage({ cache_read_input_tokens: 1_000_000 }), offPeak), 0.02)
  // 缓存写入按未命中价计
  assert.equal(estimateCost('deepseek-flash', usage({ cache_creation_input_tokens: 1_000_000 }), offPeak), 1)
})

test('estimateCost defaults to flash and sums token kinds', () => {
  const offPeak = new Date('2026-11-23T00:00:00Z')
  const mixed = usage({ input_tokens: 500_000, output_tokens: 250_000, cache_read_input_tokens: 1_000_000 })
  // 0.5*1 + 0.25*4 + 1*0.02 = 1.52
  assert.equal(estimateCost(null, mixed, offPeak), 1.52)
})

test('formatCost trims trailing zeros with adaptive precision', () => {
  assert.equal(formatCost(0), '0')
  assert.equal(formatCost(0.0001), '0.0001')
  assert.equal(formatCost(0.005), '0.005')
  assert.equal(formatCost(1.5), '1.5')
  assert.equal(formatCost(0.01), '0.01')
})

test('formatTokens abbreviates K and M', () => {
  assert.equal(formatTokens(999), '999')
  assert.equal(formatTokens(1000), '1.0K')
  assert.equal(formatTokens(1500), '1.5K')
  assert.equal(formatTokens(1_000_000), '1.0M')
  assert.equal(formatTokens(1_500_000), '1.5M')
})