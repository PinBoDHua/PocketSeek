import { registerPlugin } from '@capacitor/core'

type SystemBarsPlugin = {
  setStyle: (options: { style: 'LIGHT' | 'DARK' | 'DEFAULT' }) => Promise<void>
}

type ThemeBackgroundPlugin = {
  setColor: (options: { color: string }) => Promise<void>
}

/** Capacitor 8 内置的 SystemBars 插件（Android 系统栏外观） */
const systemBars = registerPlugin<SystemBarsPlugin>('SystemBars')
/** 自定义原生插件：把状态栏/手势栏背后的窗口底色同步为网页主题色 */
const themeBackground = registerPlugin<ThemeBackgroundPlugin>('ThemeBackground')

export const isNativeShell = (): boolean => {
  const capacitor = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor
  return Boolean(capacitor?.isNativePlatform?.())
}

/**
 * 让 Android 状态栏 / 手势栏的图标明暗跟随应用主题：
 * 浅色主题用深色图标（LIGHT），深色主题用浅色图标（DARK）。
 * 浏览器环境直接跳过。
 */
export const syncSystemBars = (theme: 'light' | 'dark') => {
  if (!isNativeShell()) {
    return
  }
  systemBars.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {
    // 插件不可用不影响页面功能
  })
  themeBackground.setColor({ color: theme === 'dark' ? '#151517' : '#ffffff' }).catch(() => {
    // 旧版本原生壳没有该插件时静默跳过
  })
}
