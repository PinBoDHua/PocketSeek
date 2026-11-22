import { useSyncExternalStore } from 'react'

/** 浏览器/WebView 报告的断网状态；不等于服务端一定可达。 */
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** 跟随 online / offline 事件重渲染，用于离线提示与待发送状态 */
export const useOnlineStatus = () => useSyncExternalStore(subscribe, () => !isOffline(), () => true)
