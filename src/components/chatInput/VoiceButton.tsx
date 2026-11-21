import clsx from 'clsx'
import { useTranslate } from '../../i18n/index.js'
import { IconMicFill16, IconMicOutline16 } from '../base/icons.js'
import { Tooltip } from '../base/Tooltip.js'
import type { VoiceInputStatus } from './useVoiceInput.js'
import styles from './VoiceButton.module.css'

/**
 * 语音输入按钮。
 * 录音中为两层圆：外层半透明光圈 + 内层实心品牌色；
 * 外层先展开、内层随后放大，之后外层按固定节奏呼吸，与音量无关。
 * 录音状态与暂停/继续在输入区展示（见 ChatInput 的录音状态条）。
 */
export const VoiceButton = ({
  status,
  disabled = false,
  paused = false,
  onClick,
}: {
  status: VoiceInputStatus
  /** 非安全上下文中按钮置灰，tooltip 提示录音需要 HTTPS */
  disabled?: boolean
  /** 录音已暂停：停止呼吸动画，避免误以为还在采集 */
  paused?: boolean
  onClick: () => void
}) => {
  const t = useTranslate()
  const recording = status === 'recording'

  const label = disabled
    ? t('voiceInputRequiresHttps')
    : recording
      ? t('voiceInputStop')
      : status === 'transcribing'
        ? t('voiceInputCancel')
        : t('voiceInput')

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={clsx(
          styles.button,
          recording && styles.recording,
          paused && styles.paused,
          disabled && styles.disabled
        )}
        aria-label={label}
        aria-pressed={recording}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) {
            onClick()
          }
        }}
      >
        {recording ? (
          <span className={styles.active}>
            <span className={styles.halo} />
            <span className={styles.core} />
            <span className={styles.outline}>
              <IconMicOutline16 />
            </span>
            <span className={styles.glyph}>
              <IconMicFill16 />
            </span>
          </span>
        ) : status === 'transcribing' ? (
          <span className={styles.loading} />
        ) : (
          <IconMicOutline16 />
        )}
      </button>
    </Tooltip>
  )
}
