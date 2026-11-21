import { useSyncExternalStore } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = 'available' | 'installed' | 'unavailable'

type Snapshot = InstallState

/** 是否运行在 Capacitor 原生壳（APK）里：此时不需要 PWA 安装与 Service Worker */
const isNativeShell = (): boolean => {
  const capacitor = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor
  return Boolean(capacitor?.isNativePlatform?.())
}

const listeners = new Set<() => void>()
let deferredPrompt: InstallPromptEvent | null = null
let installed =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || isNativeShell())

const emit = () => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Snapshot => {
  if (installed) {
    return 'installed'
  }
  return deferredPrompt ? 'available' : 'unavailable'
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // 阻止浏览器默认横幅，改由「关于」页里的按钮触发安装
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
}

/** 安装到桌面：支持时返回按钮可用的状态，安装完成后状态变为 installed。 */
export const usePwaInstall = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const install = async (): Promise<boolean> => {
    const prompt = deferredPrompt
    if (!prompt) {
      return false
    }
    await prompt.prompt()
    const choice = await prompt.userChoice
    deferredPrompt = null
    emit()
    return choice.outcome === 'accepted'
  }
  return { state, install }
}

/**
 * 注册 Service Worker：只在安全上下文（HTTPS / localhost）生效。
 * 通过局域网 http 访问时浏览器不允许注册，页面功能不受影响，只是没有离线壳。
 */
export const registerServiceWorker = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  // 原生壳内置了完整资源，不需要离线壳（也避免 SW 缓存导致升级后仍加载旧资源）
  if (isNativeShell()) {
    return
  }
  const { protocol, hostname } = window.location
  const secure =
    protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1' ||
    hostname === '::1'
  if (!secure) {
    return
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 离线壳不可用时不影响在线功能
    })
  })
}
