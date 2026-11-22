import { create } from 'zustand'

/** 置顶只影响本机的侧边栏排序，不写进会话数据，避免污染导出归档。 */
const STORAGE_KEY = 'pocketseek:pinned-sessions'

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const write = (ids: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // 存储不可用时只在内存中生效
  }
}

export const usePins = create<{ ids: string[] }>(() => ({ ids: read() }))

export const isPinned = (id: string): boolean => usePins.getState().ids.includes(id)

export const togglePin = (id: string) => {
  const current = usePins.getState().ids
  const ids = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]
  write(ids)
  usePins.setState({ ids })
}

/** 删除会话时清理置顶标记 */
export const removePins = (ids: string[]) => {
  const next = usePins.getState().ids.filter((id) => !ids.includes(id))
  write(next)
  usePins.setState({ ids: next })
}

/** 替换历史/清空全部后旧会话 ID 全部失效，置顶列表整体清空 */
export const clearPins = () => {
  write([])
  usePins.setState({ ids: [] })
}
