import { useTranslate } from '../../i18n/index.js'
import type { AssistantMessage } from '../../services/chat/types.js'
import { estimateCost, formatCost, formatTokens } from '../../services/pricing.js'
import { useSettings } from '../../services/settings.js'
import styles from './UsageFootnote.module.css'

/**
 * 回复下方的用量脚注：本回合输入 / 缓存命中 / 输出 tokens 与按官方价目估算的人民币费用。
 * 数据来自每一次请求的 message_start / message_delta。
 */
export const UsageFootnote = ({ message }: { message: AssistantMessage }) => {
  const t = useTranslate()
  const showUsage = useSettings((state) => state.showUsage)
  const usage = message.usage
  if (!showUsage || !usage) {
    return null
  }
  const cost = estimateCost(message.model, usage)
  return (
    <div className={styles.footnote}>
      <span className={styles.label}>{t('usageLabel')}</span>
      <span className={styles.token}>
        {t('usageInput', { count: formatTokens(usage.input_tokens) })}
      </span>
      {usage.cache_read_input_tokens > 0 ? (
        <span className={styles.token}>
          {t('usageCacheHit', { count: formatTokens(usage.cache_read_input_tokens) })}
        </span>
      ) : null}
      <span className={styles.token}>
        {t('usageOutput', { count: formatTokens(usage.output_tokens) })}
      </span>
      <span className={styles.cost} title={t('usageEstimatedTip')}>
        {t('usageEstimate', { cost: formatCost(cost) })}
      </span>
    </div>
  )
}
