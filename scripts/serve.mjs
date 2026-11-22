/**
 * PocketSeek 静态服务器：把 dist/ 跑在 0.0.0.0 上，方便手机用局域网地址访问。
 * 用法：pnpm build && pnpm serve   （可用 PORT=8080 pnpm serve 改端口）
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '0.0.0.0'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer(async (request, response) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Bad request')
    return
  }
  if (pathname.endsWith('/')) {
    pathname += 'index.html'
  }
  const filePath = normalize(join(root, pathname))
  const relativePath = relative(root, filePath)
  try {
    if (relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath) || relativePath === '..') {
      throw new Error('outside root')
    }
    const data = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      // 只有带 contenthash 的 /static/ 资源可长缓存；index/sw 走协商
      'Cache-Control': pathname.startsWith('/static/')
        ? 'public, max-age=31536000'
        : 'no-cache',
    })
    response.end(data)
  } catch {
    const acceptsHtml = (request.headers.accept ?? '').includes('text/html')
    if (request.method === 'GET' && acceptsHtml && extname(pathname) === '') {
      try {
        const html = await readFile(join(root, 'index.html'))
        response.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' })
        response.end(html)
        return
      } catch {
        // 回退失败按 404 处理。
      }
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found. 请先运行 pnpm build 生成 dist/。')
  }
})

server.listen(port, host, () => {
  console.log(`PocketSeek 已启动：http://localhost:${port}`)
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  手机（同一 Wi-Fi）：http://${address.address}:${port}`)
      }
    }
  }
  console.log('  提示：在 App 设置 → 数据管理里填入你自己的 DeepSeek API Key 即可开始。')
})
