import { useCallback, useState } from 'react'

const STORAGE_KEY = 'pocketseek:session-groups-collapsed'

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : []
  } catch {
    return []
  }
}

const write = (keys: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // 存储不可用时折叠状态只在本次会话内生效
  }
}

/** 日期分组的折叠状态：折叠的组 key 本机持久化，搜索态由调用方忽略 */
export const useCollapsedSessionGroups = () => {
  const [collapsed, setCollapsed] = useState<string[]>(read)

  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
      write(next)
      return next
    })
  }, [])

  return { collapsed, toggle }
}
