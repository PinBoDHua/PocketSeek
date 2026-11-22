import { create } from 'zustand'

/**
 * 离线发件箱：断网时发送的消息先在会话里落成 queued 回复，
 * 这里只记录「哪条提问还没发出去」，重启后凭它恢复补发。
 */
export type OutboxEntry = {
  sessionId: string
  questionId: string
  replyId: string
  createdAt: number
}

const STORAGE_KEY = 'pocketseek:outbox'

const isEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Partial<OutboxEntry>
  return (
    typeof entry.sessionId === 'string' &&
    typeof entry.questionId === 'string' &&
    typeof entry.replyId === 'string' &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt)
  )
}

const readEntries = (): OutboxEntry[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

const writeEntries = (entries: OutboxEntry[]) => {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
  } catch {
    // 存储不可用时只在本次会话内生效
  }
}

export const useOutbox = create<{ entries: OutboxEntry[] }>(() => ({ entries: readEntries() }))

const setEntries = (entries: OutboxEntry[]) => {
  useOutbox.setState({ entries })
  writeEntries(entries)
}

export const getOutboxEntry = (replyId: string) =>
  useOutbox.getState().entries.find((entry) => entry.replyId === replyId)

export const hasSessionOutbox = (sessionId: string) =>
  useOutbox.getState().entries.some((entry) => entry.sessionId === sessionId)

/** 同一回复只保留一条记录；网络失败补发时原时间不变，队列顺序稳定。 */
export const addOutboxEntry = (entry: OutboxEntry) => {
  const entries = useOutbox.getState().entries
  if (entries.some((item) => item.replyId === entry.replyId)) {
    return
  }
  setEntries([...entries, entry])
}

export const removeOutboxEntry = (replyId: string) => {
  const entries = useOutbox.getState().entries
  if (entries.some((entry) => entry.replyId === replyId)) {
    setEntries(entries.filter((entry) => entry.replyId !== replyId))
  }
}

export const clearOutboxForSession = (sessionId: string) => {
  const entries = useOutbox.getState().entries
  if (entries.some((entry) => entry.sessionId === sessionId)) {
    setEntries(entries.filter((entry) => entry.sessionId !== sessionId))
  }
}

export const clearOutbox = () => {
  if (useOutbox.getState().entries.length > 0) {
    setEntries([])
  }
}

export const sortedOutboxEntries = () =>
  [...useOutbox.getState().entries].sort((a, b) => a.createdAt - b.createdAt)
