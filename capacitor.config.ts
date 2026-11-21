import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置：把 PocketSeek 的 dist/ 打进 Android 原生壳。
 * webDir 指向 rspack 产物；androidScheme 设为 https，使 WebView 运行在安全上下文
 * （localStorage / Service Worker / 摄像头 API 与浏览器一致）。
 */
const config: CapacitorConfig = {
  appId: 'com.pocketseek.app',
  appName: 'PocketSeek',
  webDir: 'dist',
  android: {
    androidScheme: 'https',
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
}

export default config
