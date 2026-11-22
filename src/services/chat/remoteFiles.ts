import { deleteFile } from '../api/client.js'
import { isOffline } from '../network.js'
import { useSettings } from '../settings.js'
import type { Session } from './types.js'

/** 删除会话/清空历史后待清理的 Files API file_id；失败留在队列里等下次联网重试。 */
const STORAGE_KEY = 'pocketseek:remote-file-deletions'
const MAX_BATCH = 20

const read = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const write = (ids: string[]) => {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    }
  } catch {
    // 存储不可用时只在本页内尝试
  }
}

export const collectServerIds = (session: Session): string[] =>
  session.messages.flatMap((message) =>
    message.role === 'user'
      ? message.files.flatMap((file) => (file.serverId ? [file.serverId] : []))
      : []
  )

export const enqueueRemoteFileDeletions = (ids: Iterable<string>) => {
  const next = new Set(read())
  for (const id of ids) {
    next.add(id)
  }
  write([...next])
}

let flushing = false

export const flushRemoteFileDeletions = async () => {
  if (flushing || isOffline()) {
    return
  }
  const apiKey = useSettings.getState().apiKey
  if (!apiKey) {
    return
  }
  const ids = read()
  if (ids.length === 0) {
    return
  }
  flushing = true
  const remaining: string[] = []
  try {
    let attempted = 0
    for (const id of ids) {
      if (attempted >= MAX_BATCH || isOffline()) {
        remaining.push(id)
        continue
      }
      attempted += 1
      try {
        await deleteFile(apiKey, id)
      } catch {
        remaining.push(id)
      }
    }
  } finally {
    write(remaining)
    flushing = false
  }
}
