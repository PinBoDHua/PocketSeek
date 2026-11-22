/**
 * 本地 mock API：只用于在雷电/浏览器里验收 UI 与流式渲染，不访问真实 DeepSeek 服务。
 * 用法：node scripts/mock-api.mjs   （默认 127.0.0.1:4174）
 *
 * 配合构建：POCKETSEEK_API_ORIGIN=http://127.0.0.1:4174 pnpm build
 * 注意：交付版必须用默认 origin（https://api.deepseek.com）重新构建。
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_PORT ?? 4174)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'content-type,authorization,x-api-key,anthropic-beta,anthropic-version',
}

const THINKING =
  '先用一句话复述用户的问题，再判断要不要查资料。这是一个本地 mock 的思考片段，' +
  '用来验证思考折叠区、思考计时以及“正在思考”状态是否正常。'

const ENCODER = new TextEncoder()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const writeEvent = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

const MOCK_ANSWER = `这是 **PocketSeek 本地 mock** 返回的示例回复，用来验证渲染链路：

## 流式正文
逐字输出、自动滚动、停止按钮都能正常工作。

## 代码与公式
\`\`\`ts
const reply = await pocketseek.chat('你好')
console.log(reply.usage)
\`\`\`

行内公式 $E = mc^2$，以及列表：

- 思考过程折叠
- 用量与费用脚注
- Markdown / KaTeX / 代码高亮`

const stream = async (res) => {
  res.writeHead(200, {
    ...CORS,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  writeEvent(res, 'message_start', {
    type: 'message_start',
    message: {
      id: 'mock-message-0001',
      model: 'deepseek-flash',
      usage: {
        input_tokens: 386,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 2048,
        output_tokens: 0,
      },
    },
  })
  await sleep(120)

  writeEvent(res, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'thinking', thinking: '', signature: '' },
  })
  for (const chunk of THINKING.match(/.{1,18}/gsu) ?? []) {
    writeEvent(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: chunk },
    })
    await sleep(24)
  }
  writeEvent(res, 'content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'signature_delta', signature: 'mock-signature' },
  })
  writeEvent(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  await sleep(120)

  writeEvent(res, 'content_block_start', {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'text', text: '' },
  })
  for (const chunk of MOCK_ANSWER.match(/.{1,12}/gsu) ?? []) {
    writeEvent(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'text_delta', text: chunk },
    })
    await sleep(18)
  }
  writeEvent(res, 'content_block_stop', { type: 'content_block_stop', index: 1 })

  writeEvent(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null, title: '本地 mock 验收对话' },
    usage: {
      input_tokens: 386,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 2048,
      output_tokens: 246,
    },
  })
  writeEvent(res, 'message_stop', { type: 'message_stop' })
  res.end()
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  console.log(`${new Date().toISOString()} ${request.method} ${url.pathname}`)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS).end()
    return
  }
  if (request.method === 'GET' && url.pathname === '/models') {
    response
      .writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash' }] }))
    return
  }
  if (request.method === 'POST' && url.pathname === '/anthropic/v1/files') {
    request.resume()
    request.on('end', () => {
      response
        .writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
        .end(
          JSON.stringify({
            id: 'file-api-mock',
            type: 'file',
            size_bytes: 1024,
            created_at: new Date().toISOString(),
            filename: 'mock.png',
            mime_type: 'image/png',
          })
        )
    })
    return
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/anthropic/v1/files/')) {
    request.resume()
    response.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end('{}')
    return
  }
  if (request.method === 'POST' && url.pathname === '/anthropic/v1/messages') {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      // 联调时核对请求构造：system 长度与尾部（自定义提示词追加在身份说明之后）
      try {
        const body = JSON.parse(raw)
        const system = String(body.system ?? '')
        console.log(`[mock] system len=${system.length} tail=${JSON.stringify(system.slice(-40))}`)
      } catch {
        // 非 JSON 请求体忽略
      }
      void stream(response).catch(() => {
        if (!response.writableEnded) {
          response.end()
        }
      })
    })
    return
  }
  response.writeHead(404, { ...CORS, 'Content-Type': 'application/json' }).end('{"error":"not found"}')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PocketSeek mock API: http://127.0.0.1:${PORT}`)
  void ENCODER
})
