type Mermaid = typeof import('mermaid').default

let mermaidPromise: Promise<Mermaid> | null = null
let renderQueue = Promise.resolve()
let nextId = 0

const loadMermaid = () => {
  mermaidPromise ??= import('mermaid')
    .then((module) => module.default)
    .catch((error: unknown) => {
      mermaidPromise = null
      throw error
    })
  return mermaidPromise
}

/**
 * 移除 Mermaid 指令与 YAML frontmatter：主题由本应用控制，不允许模型通过
 * themeCSS/config 注入全局样式或改写渲染配置。
 */
const stripMermaidConfig = (code: string) =>
  code.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/%%\{[\s\S]*?\}%%/g, '')

/** 转义图片标签，对同一图中的全部标签生效。 */
const sanitizeMermaid = (code: string) => code.replace(/<((?:img|image)\s+)/gi, '&lt;$1')

/** 串行执行初始化和绘制，避免不同图表互相覆盖 Mermaid 的全局配置。 */
export const renderMermaid = (
  code: string,
  dark: boolean,
  isCancelled: () => boolean
): Promise<string | null> => {
  const result = renderQueue.then(async () => {
    const source = sanitizeMermaid(stripMermaidConfig(code))
    if (isCancelled() || !source.trim()) {
      return null
    }

    const mermaid = await loadMermaid()
    if (isCancelled()) {
      return null
    }

    mermaid.initialize({
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      startOnLoad: false,
      suppressErrorRendering: true,
    })

    const { svg } = await mermaid.render(`standalone-mermaid-${nextId++}`, source)
    return isCancelled() ? null : svg
  })

  // 某张图失败不阻塞后续图表；调用方仍收到原始任务的错误。
  renderQueue = result.then(
    () => {},
    () => {}
  )
  return result
}
