import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import styles from './Spectrum.module.css'

/** 与设计稿一致：2px 宽、3px 间距，静止 5px */
const BAR_WIDTH = 2
const BAR_GAP = 3
const BAR_MIN = 5
const BAR_MAX = 32
const MAX_BARS = 60
/** 每秒从右向左滚过一格的振幅样本；60Hz 屏幕正好每帧一格 */
const SAMPLES_PER_SECOND = 60
/** 时域 RMS 到柱高的映射区间：低于底噪不起跳，接近满幅封顶 */
const RMS_FLOOR = 0.005
const RMS_CEIL = 0.3

/**
 * 录音中的滚动振幅波形：每帧从 AnalyserNode 取时域数据算 RMS，
 * 新样本从右侧进入、历史样本向左滚动，形成一条连续的声音轨迹。
 * 每帧只改 transform，不触发 React 渲染；暂停时停止取样并压暗波形。
 */
export const Spectrum = ({
  getAnalyser,
  paused = false,
}: {
  getAnalyser: () => AnalyserNode | null
  /** 录音暂停时定格当前波形 */
  paused?: boolean
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  /** 采样历史在暂停/继续之间保留，恢复后接着滚动而不是从头开始 */
  const historyRef = useRef<Float32Array | null>(null)
  const [count, setCount] = useState(0)

  // 按容器宽度决定柱数
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width + BAR_GAP) / (BAR_WIDTH + BAR_GAP))
      setCount(Math.min(MAX_BARS, fit))
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || count < 1 || paused) {
      return
    }
    const bars = Array.from(root.children) as HTMLElement[]
    const history =
      historyRef.current?.length === count ? historyRef.current : new Float32Array(count)
    historyRef.current = history
    const stepMs = 1000 / SAMPLES_PER_SECOND
    let samples = new Float32Array(0)
    let frame = 0
    let last = performance.now()
    let carry = 0
    let level = 0

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      carry += Math.min(now - last, 200)
      last = now
      if (carry < stepMs) {
        return
      }
      // 高刷屏按时间补帧，保证不同刷新率下滚动速度一致
      const steps = Math.min(3, Math.floor(carry / stepMs))
      carry -= steps * stepMs
      const analyser = getAnalyser()
      let target = 0
      if (analyser) {
        if (samples.length !== analyser.fftSize) {
          samples = new Float32Array(analyser.fftSize)
        }
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (let index = 0; index < samples.length; index += 1) {
          sum += samples[index] * samples[index]
        }
        const rms = Math.sqrt(sum / samples.length)
        const normalized = Math.min(1, Math.max(0, (rms - RMS_FLOOR) / (RMS_CEIL - RMS_FLOOR)))
        // 开方抬高小音量，让普通说话也有明显起伏
        target = Math.sqrt(normalized)
      }
      level += (target - level) * 0.5
      history.copyWithin(0, steps)
      history.fill(level, count - steps)
      for (let index = 0; index < count; index += 1) {
        const height = BAR_MIN + (BAR_MAX - BAR_MIN) * history[index]
        bars[index].style.transform = `scaleY(${Math.round((height / BAR_MIN) * 100) / 100})`
      }
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [count, getAnalyser, paused])

  return (
    <div ref={rootRef} className={clsx(styles.spectrum, paused && styles.paused)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={styles.bar} />
      ))}
    </div>
  )
}
