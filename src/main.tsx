import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import { hydrateApiKey } from './services/settings.js'
import { registerServiceWorker } from './pwa.js'
import './app/theme.css'
import './app/global.css'

const start = async () => {
  // 原生壳从 Keystore 读取 API Key，读完再渲染，避免设置页先闪一下“未配置”。
  await hydrateApiKey()
  ensureKatex()
  setupTheme()
  registerServiceWorker()
  createRoot(document.getElementById('root') as HTMLElement).render(<App />)
}

void start()
