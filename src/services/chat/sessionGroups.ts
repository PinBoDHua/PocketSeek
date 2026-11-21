import { translate } from '../../i18n/index.js'
import { monthKey } from '../../utils/format.js'
import type { SessionSummary } from './types.js'

const DAY = 86_400_000

/** 置顶分组的 key，同时作为折叠状态持久化的标识 */
export const PINNED_GROUP_KEY = 'pinned'

export type SessionGroup = { key: string; label: string; sessions: SessionSummary[] }

const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0)

/** 按标题过滤（不区分大小写），置顶结果按置顶顺序排在最前，其余保持会话列表原有顺序 */
export const searchSessions = (
  sessions: SessionSummary[],
  query: string,
  t = translate,
  pinnedIds: string[] = []
): SessionSummary[] => {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return sessions
  }
  const matched = new Set<string>()
  for (const session of sessions) {
    if ((session.title || t('untitledChat')).toLowerCase().includes(keyword)) {
      matched.add(session.id)
    }
  }
  const byId = new Map<string, SessionSummary>()
  for (const session of sessions) {
    byId.set(session.id, session)
  }
  const pinnedSet = new Set(pinnedIds)
  const ordered: SessionSummary[] = []
  const seen = new Set<string>()
  for (const id of pinnedIds) {
    const session = byId.get(id)
    if (session && matched.has(id) && !seen.has(id)) {
      seen.add(id)
      ordered.push(session)
    }
  }
  for (const session of sessions) {
    if (matched.has(session.id) && !pinnedSet.has(session.id)) {
      ordered.push(session)
    }
  }
  return ordered
}

/** 分组：置顶（固定的 key 排最前）/ 今天 / 昨天 / 7 天内 / 30 天内 / 按月，置顶会话不重复进日期分组 */
export const groupSessions = (
  sessions: SessionSummary[],
  now: number,
  t = translate,
  pinnedIds: string[] = []
): SessionGroup[] => {
  const groups: SessionGroup[] = []
  const byId = new Map<string, SessionSummary>()
  for (const session of sessions) {
    byId.set(session.id, session)
  }
  const pinned: SessionSummary[] = []
  const seen = new Set<string>()
  for (const id of pinnedIds) {
    const session = byId.get(id)
    if (session && !seen.has(id)) {
      seen.add(id)
      pinned.push(session)
    }
  }
  if (pinned.length > 0) {
    groups.push({ key: PINNED_GROUP_KEY, label: t('pinnedGroupLabel'), sessions: pinned })
  }
  const pinnedSet = new Set(pinnedIds)
  for (const session of sessions) {
    if (pinnedSet.has(session.id)) {
      continue
    }
    const diff = Math.floor((now - startOfDay(session.updatedAt)) / DAY)
    const key =
      diff <= 0
        ? 'sessionHistoryTimelineLabelToday'
        : diff <= 1
          ? 'sessionHistoryTimelineLabelYesterday'
          : diff < 7
            ? 'sessionHistoryTimelineLabel7days'
            : diff < 30
              ? 'sessionHistoryTimelineLabel30days'
              : null
    const groupKey = key ?? monthKey(session.updatedAt) ?? ''
    const last = groups.at(-1)
    if (last?.key === groupKey && last.key !== PINNED_GROUP_KEY) {
      last.sessions.push(session)
    } else {
      groups.push({ key: groupKey, label: key ? t(key) : groupKey, sessions: [session] })
    }
  }
  return groups
}
