/**
 * 跨平台生产构建：Windows 的 cmd 不识别 `NODE_ENV=production pnpm build` 这类前缀写法，
 * 这里统一设置环境变量、清理 dist 后启动 rspack。
 */
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true })

const rspack = fileURLToPath(new URL('../node_modules/@rspack/cli/bin/rspack.js', import.meta.url))
const child = spawn(process.execPath, [rspack, 'build', '-c', 'rspack.config.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
