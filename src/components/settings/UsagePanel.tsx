import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { loadUsageStats, type UsageStats } from '../../services/chat/stats.js'
import { formatCost, formatTokens } from '../../services/pricing.js'
import { Button } from '../base/Button.js'
import styles from './UsagePanel.module.css'

const TONES = ['input', 'hit', 'write', 'output'] as const

/**
 * 用量统计：全部本地会话的总量、token 构成、近 7 天趋势与按模型拆分。
 * 打开时即时聚合，不缓存结果；会话变化后点「刷新」重新统计。
 */
export const UsagePanel = () => {
  const t = useTranslate()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef(0)

  const refresh = useCallback(() => {
    const id = request.current + 1
    request.current = id
    setLoading(true)
    setFailed(false)
    void loadUsageStats()
      .then((next) => {
        if (request.current === id) {
          setStats(next)
        }
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[usage] local aggregation failed', error)
        if (request.current === id) {
          setFailed(true)
        }
      })
      .finally(() => {
        if (request.current === id) {
          setLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    refresh()
    return () => {
      request.current += 1
    }
  }, [refresh])

  const rows = stats
    ? [
        { tone: TONES[0], label: t('usageStatsInput'), value: stats.input },
        { tone: TONES[1], label: t('usageStatsCacheHit'), value: stats.cacheHit },
        { tone: TONES[2], label: t('usageStatsCacheWrite'), value: stats.cacheCreate },
        { tone: TONES[3], label: t('usageStatsOutput'), value: stats.output },
      ]
    : []
  const dayMax = stats ? Math.max(1, ...stats.days.map((day) => day.tokens)) : 1

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.title}>{t('usageStatsTitle')}</div>
          <div className={styles.subtitle}>{t('usageStatsDescription')}</div>
        </div>
        <Button variant="outlined" size="s" disabled={loading} onClick={refresh}>
          {loading ? t('usageStatsLoading') : t('refresh')}
        </Button>
      </div>

      {failed ? (
        <div className={styles.error} role="alert">
          <span>{stats ? t('usageStatsRefreshFailed') : t('usageStatsFailed')}</span>
          <Button variant="outlined" size="s" onClick={refresh}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {!stats && loading ? <div className={styles.status}>{t('usageStatsLoading')}</div> : null}

      {stats ? (
        <>
          <div className={styles.summary}>
            <div className={styles.card}>
              <span className={styles.cardValue}>{stats.sessions}</span>
              <span className={styles.cardLabel}>{t('usageStatsSessions')}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardValue}>{stats.replies}</span>
              <span className={styles.cardLabel}>{t('usageStatsReplies')}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardValue}>{formatTokens(stats.tokens)}</span>
              <span className={styles.cardLabel}>{t('usageStatsTokens')}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardValue}>≈¥{formatCost(stats.cost)}</span>
              <span className={styles.cardLabel}>{t('usageStatsCost')}</span>
            </div>
          </div>

          {stats.replies === 0 ? (
            <div className={styles.empty}>{t('usageStatsEmpty')}</div>
          ) : (
            <>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>{t('usageStatsBreakdown')}</div>
                {rows.map((row) => {
                  const percent = stats.tokens > 0 ? (row.value / stats.tokens) * 100 : 0
                  return (
                    <div key={row.tone} className={styles.breakRow}>
                      <span className={styles.breakLabel}>{row.label}</span>
                      <span className={styles.breakValue}>{formatTokens(row.value)}</span>
                      <span className={styles.breakTrack} aria-hidden>
                        <span
                          className={styles.breakFill}
                          data-tone={row.tone}
                          style={{ width: `${row.value > 0 ? Math.max(percent, 1) : 0}%` }}
                        />
                      </span>
                      <span className={styles.breakShare}>{percent.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>{t('usageStatsLast7Days')}</div>
                <div
                  className={styles.chart}
                  role="img"
                  aria-label={t('usageStatsChartLabel', {
                    tokens: formatTokens(stats.days.reduce((sum, day) => sum + day.tokens, 0)),
                    cost: formatCost(stats.days.reduce((sum, day) => sum + day.cost, 0)),
                  })}
                >
                  {stats.days.map((day) => (
                    <div key={day.date} className={styles.chartCol}>
                      <div
                        className={styles.chartBarArea}
                        title={t('usageStatsDayTip', {
                          date: day.date,
                          tokens: formatTokens(day.tokens),
                          cost: formatCost(day.cost),
                        })}
                      >
                        <span
                          className={styles.chartBar}
                          style={{
                            height:
                              day.tokens > 0
                                ? `${Math.max((day.tokens / dayMax) * 100, 4)}%`
                                : '0%',
                          }}
                        />
                      </div>
                      <span className={styles.chartLabel}>{day.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {stats.models.length > 0 ? (
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>{t('usageStatsByModel')}</div>
                  {stats.models.map((model) => (
                    <div key={model.model} className={styles.modelRow}>
                      <span className={styles.modelName}>
                        {t(model.model === 'deepseek-v4-pro' ? 'modelProShort' : 'modelFlashShort')}
                      </span>
                      <span className={styles.modelMeta}>
                        {t('usageStatsModelReplies', { count: model.replies })} ·{' '}
                        {formatTokens(model.tokens)} tokens
                      </span>
                      <span className={styles.modelCost}>≈¥{formatCost(model.cost)}</span>
                    </div>
                  ))}
                </section>
              ) : null}

              <p className={styles.footnote}>{t('usageStatsFootnote')}</p>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
