import { useTranslate } from '../../i18n/index.js'
import { memo, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Prism from 'prismjs'
import {
  getHighlightLang,
  isHighlightLoaded,
  loadHighlight,
} from '../../services/markdown/highlight.js'
import { IconChevronUpDown16 } from '../base/actionIcons.js'
import { IconCheckOutline16, IconCopyOutline16 } from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import { copyText } from '../../utils/clipboard.js'
import { MermaidDiagram } from './MermaidDiagram.js'
import styles from './CodeBlock.module.css'

/** 折叠预览保留的行数，也是出现折叠按钮的行数阈值 */
const FOLD_LINE_LIMIT = 12

/** 去掉末尾换行后的源码行数 */
const countLines = (code: string) => {
  const normalized = code.endsWith('\n') ? code.slice(0, -1) : code
  return normalized ? normalized.split('\n').length : 0
}

/** 折叠时只保留前 12 行，避免长代码在预览态做整段高亮 */
const foldCode = (code: string) => {
  const lines = (code.endsWith('\n') ? code.slice(0, -1) : code).split('\n')
  return lines.length > FOLD_LINE_LIMIT ? lines.slice(0, FOLD_LINE_LIMIT).join('\n') : code
}

/** 代码块标题栏：左侧语言名 + 行数，右侧折叠 / 展开与复制 */
const CodeInfoRow = ({
  code,
  infostring,
  lineCount,
  foldable,
  folded,
  onToggleFold,
  showDiagram,
  onToggleDiagram,
}: {
  code: string
  infostring: string
  lineCount: number
  foldable: boolean
  folded: boolean
  onToggleFold: () => void
  showDiagram: boolean
  onToggleDiagram?: () => void
}) => {
  const t = useTranslate()
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current)
      }
    },
    []
  )
  return (
    <div className={styles.container}>
      {onToggleDiagram ? (
        <div className="md-code-block-switch" aria-label={t('mermaidSwitchLabel')}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={showDiagram}
            onClick={() => !showDiagram && onToggleDiagram()}
          >
            {t('mermaidDiagram')}
          </button>
          <button
            type="button"
            className={styles.button}
            aria-pressed={!showDiagram}
            onClick={() => showDiagram && onToggleDiagram()}
          >
            {t('mermaidCode')}
          </button>
        </div>
      ) : (
        <span className={styles.meta}>
          <span className={styles.name}>{infostring}</span>
          {lineCount > 0 ? (
            <span className={styles.lineCount}>{t('codeLineCount', { count: lineCount })}</span>
          ) : null}
        </span>
      )}
      <div className={styles.actions}>
        {foldable ? (
          <button
            type="button"
            className={styles.button}
            aria-expanded={!folded}
            onClick={onToggleFold}
          >
            <IconChevronUpDown16 />
            <span>{t(folded ? 'codeExpand' : 'codeFold')}</span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.button}
          onClick={async () => {
            if (!(await copyText(code))) {
              showToast({ key: 'copyFailed' })
              return
            }
            setCopied(true)
            // 连续点击重置计时器；卸载时清理，避免卸载后 setState
            if (resetTimer.current !== null) {
              clearTimeout(resetTimer.current)
            }
            resetTimer.current = setTimeout(() => {
              resetTimer.current = null
              setCopied(false)
            }, 1500)
          }}
        >
          {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
          <span>{t(copied ? 'copied' : 'copy')}</span>
        </button>
      </div>
    </div>
  )
}

/** 代码块：语言包按需加载，不支持或尚未加载的语言按纯文本显示 */
export const CodeBlock = memo(function CodeBlock({
  code,
  infostring,
  loading = false,
}: {
  code: string
  infostring: string
  loading?: boolean
}) {
  const isMermaid = infostring.toLowerCase() === 'mermaid'
  const [showDiagram, setShowDiagram] = useState(true)
  const [folded, setFolded] = useState(false)
  const lineCount = useMemo(() => countLines(code), [code])
  // Mermaid 用「图 / 码」切换代替折叠；其余代码块达到阈值才显示折叠按钮
  const foldable = !isMermaid && lineCount >= FOLD_LINE_LIMIT
  // 语言包注册在全局 Prism 上，每次渲染直接判断；加载完成后触发一次重渲染
  const rerender = useReducer((n: number) => n + 1, 0)[1]
  const lang = getHighlightLang(infostring)
  const loaded = lang !== null && isHighlightLoaded(lang)
  useEffect(() => {
    if (lang === null || loaded) {
      return
    }
    let unmounted = false
    loadHighlight(lang).then(() => {
      if (!unmounted) {
        rerender()
      }
    })
    return () => {
      unmounted = true
    }
  }, [lang, loaded, rerender])
  const renderedHtml = useMemo(() => {
    const name = lang !== null && loaded ? lang : 'plaintext'
    const source = folded && foldable ? foldCode(code) : code
    return Prism.highlight(source, Prism.languages[name], name)
  }, [code, folded, foldable, lang, loaded])
  return (
    <div className={`md-code-block ${styles.block}`}>
      <div className="md-code-block-banner">
        <CodeInfoRow
          code={code}
          infostring={infostring}
          lineCount={lineCount}
          foldable={foldable}
          folded={folded}
          onToggleFold={() => setFolded((value) => !value)}
          showDiagram={showDiagram}
          onToggleDiagram={isMermaid ? () => setShowDiagram((show) => !show) : undefined}
        />
      </div>
      {isMermaid && showDiagram ? (
        <MermaidDiagram code={code} loading={loading} />
      ) : (
        <>
          <pre dangerouslySetInnerHTML={{ __html: renderedHtml }}></pre>
          {folded && lineCount > FOLD_LINE_LIMIT ? (
            <div className={styles.mask} aria-hidden="true" />
          ) : null}
        </>
      )}
    </div>
  )
})
