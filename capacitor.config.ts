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
  plugins: {
    // 启动页：原生 splash 退场用 200ms 淡出，随后 Web 层再做一次极轻的淡入
    SplashScreen: {
      // 让 splash 至少停留 250ms，避免 WebView 首帧前的白屏闪烁；退场 200ms 淡出
      launchShowDuration: 250,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config
