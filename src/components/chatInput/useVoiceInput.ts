import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationMessage } from '../../i18n/index.js'
import { transcribe } from '../../services/api/speech.js'
import { startRecording, type Recording } from '../../services/speech/recorder.js'
import { useSettings } from '../../services/settings.js'
import { showToast } from '../base/toastState.js'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'

/**
 * 录音依赖 getUserMedia，只在安全上下文可用（HTTPS、localhost、file://）。
 * 普通 HTTP 页面上直接禁用入口，避免点击后必然失败。
 */
const AVAILABLE = typeof window === 'undefined' || window.isSecureContext

const describeRecordingError = (error: unknown): TranslationMessage => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return { key: 'voiceInputPermissionDenied' }
    }
    if (error.name === 'NotFoundError') {
      return { key: 'voiceInputNoDevice' }
    }
  }
  return { key: 'voiceInputFailed' }
}

/**
 * 语音输入（oneshot）：点击开始录音，再次点击结束并转写，结果交给 onText 填入输入框。
 * 转写中再次点击取消。录满 120 秒自动结束。
 * 录音中可暂停/继续：暂停期间不计时、不写入音频，结束转写前会先恢复采集。
 */
export const useVoiceInput = (onText: (text: string) => void) => {
  const [status, setStatus] = useState<VoiceInputStatus>('idle')
  /** 本次录音的有效时长（暂停时间不计），只在录音中递增 */
  const [seconds, setSeconds] = useState(0)
  /** 录音已暂停：计时冻结、波形定格 */
  const [paused, setPaused] = useState(false)
  /** 当前录音器是否支持暂停；不支持的环境退化为只能结束录音 */
  const [canPause, setCanPause] = useState(false)
  const pausedRef = useRef(false)
  const recordingRef = useRef<Recording | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const operationRef = useRef(0)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const cancelOperation = useCallback(() => {
    operationRef.current++
    recordingRef.current?.cancel()
    recordingRef.current = null
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const cancel = useCallback(() => {
    cancelOperation()
    pausedRef.current = false
    setPaused(false)
    setCanPause(false)
    setStatus('idle')
  }, [cancelOperation])

  const finish = useCallback(async () => {
    const recording = recordingRef.current
    if (!recording) {
      // 仍在等待麦克风授权时也允许取消；迟到的录音对象会立即释放。
      cancel()
      return
    }
    const operation = operationRef.current
    recordingRef.current = null
    let controller: AbortController | null = null
    try {
      let audio: Blob | null
      try {
        // 暂停中结束录音时先恢复采集，避免 WAV 尾部缺失当前时刻的声音。
        recording.resume?.()
        audio = await recording.stop()
      } finally {
        pausedRef.current = false
        setPaused(false)
        setCanPause(false)
        recording.cancel()
      }
      if (operationRef.current !== operation || !audio) {
        return
      }
      controller = new AbortController()
      controllerRef.current = controller
      setStatus('transcribing')
      const text = await transcribe(useSettings.getState().apiKey ?? '', audio, controller.signal)
      if (controller.signal.aborted || operationRef.current !== operation) {
        return
      }
      if (text.trim()) {
        onTextRef.current(text.trim())
      } else {
        showToast({ key: 'voiceInputEmpty' })
      }
    } catch {
      if (operationRef.current === operation && !controller?.signal.aborted) {
        showToast({ key: 'voiceInputFailed' })
      }
    } finally {
      if (operationRef.current === operation) {
        controllerRef.current = null
        setStatus('idle')
      }
    }
  }, [cancel])

  const toggle = useCallback(async () => {
    if (!AVAILABLE) {
      return
    }
    if (status === 'recording') {
      await finish()
      return
    }
    if (status === 'transcribing') {
      cancel()
      return
    }
    const operation = ++operationRef.current
    pausedRef.current = false
    setPaused(false)
    setCanPause(false)
    setStatus('recording')
    try {
      const recording = await startRecording(() => {
        if (operationRef.current === operation) {
          showToast({ key: 'voiceInputLimitReached' })
          void finish()
        }
      })
      if (operationRef.current !== operation) {
        recording.cancel()
        return
      }
      recordingRef.current = recording
      setCanPause(recording.pause !== null && recording.resume !== null)
    } catch (error) {
      if (operationRef.current === operation) {
        setStatus('idle')
        showToast(describeRecordingError(error))
      }
    }
  }, [status, finish, cancel])

  /** 暂停/继续当前录音；录音器不支持暂停时忽略 */
  const togglePause = useCallback(() => {
    const recording = recordingRef.current
    if (status !== 'recording' || !recording?.pause || !recording.resume) {
      return
    }
    const next = !pausedRef.current
    if (next) {
      recording.pause()
    } else {
      recording.resume()
    }
    pausedRef.current = next
    setPaused(next)
  }, [status])

  useEffect(() => {
    if (status !== 'recording') {
      pausedRef.current = false
      setPaused(false)
      setSeconds(0)
      return
    }
    setSeconds(0)
    let last = Date.now()
    let total = 0
    // 250ms 刷新一次；暂停期间不累计，与录音器实际写入的音频长度保持一致。
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (!pausedRef.current) {
        total += now - last
        setSeconds(Math.floor(total / 1000))
      }
      last = now
    }, 250)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => cancelOperation, [cancelOperation])

  /** 当前录音的频谱分析节点，未录音时为 null */
  const getAnalyser = useCallback(() => recordingRef.current?.analyser ?? null, [])

  return {
    status,
    seconds,
    paused,
    canPause,
    getAnalyser,
    toggle,
    togglePause,
    cancel,
    available: AVAILABLE,
  }
}
