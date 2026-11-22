import { translate } from '../../i18n/index.js'
import { isNativeShell } from '../../native.js'
import { copyText } from '../../utils/clipboard.js'
import { formatDate } from '../../utils/format.js'
import { getVisibleMessages } from './branches.js'
import type { AssistantMessage, Session, UserMessage } from './types.js'
import { buildReplyView } from './view.js'

const pad = (value: number) => String(value).padStart(2, '0')

const formatTime = (time: number) => {
  const date = new Date(time)
  const day = formatDate(date) ?? ''
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const inline = (text: string) => text.replace(/\s+/g, ' ').trim()

const linkText = (text: string) => text.replace(/[[\]]/g, '\\$&')

const withoutCitationMarkers = (markdown: string) =>
  markdown.replace(/\[citation:(\d+)\]/g, '[$1]')

const userSection = (message: UserMessage): string => {
  const lines = [`**我** · ${formatTime(message.createdAt)}`, '']
  if (message.content.trim()) {
    lines.push(message.content.trim(), '')
  }
  if (message.files.length > 0) {
    lines.push('附件：', ...message.files.map((file) => `- ${inline(file.name)}`), '')
  }
  return lines.join('\n').trimEnd()
}

const describeFailure = (message: AssistantMessage): string | null => {
  if (message.stopReason === 'refusal') {
    return '模型拒绝了这条请求。'
  }
  if (message.status === 'error') {
    const detail = message.error?.localMessage
      ? translate(message.error.localMessage.key, message.error.localMessage.params)
      : message.error?.message
    return detail ? `回答生成失败：${detail}` : '回答生成失败。'
  }
  if (message.status === 'stopped') {
    return '（回答已停止）'
  }
  if (message.status === 'queued') {
    return '（消息尚未发送，导出内容不含该轮）'
  }
  if (message.status === 'pending' || message.status === 'streaming') {
    return '（回答生成中，导出内容不完整）'
  }
  return null
}

const assistantSection = (message: AssistantMessage): string => {
  const view = buildReplyView(message, false)
  const sections: string[] = []
  for (const step of view.steps) {
    if (step.type === 'text' && step.markdown.trim()) {
      sections.push(withoutCitationMarkers(step.markdown.trim()))
    }
  }
  if (view.answer?.markdown.trim()) {
    sections.push(withoutCitationMarkers(view.answer.markdown.trim()))
  }
  const lines = [`**助手** · ${formatTime(message.createdAt)}`, '']
  if (sections.length > 0) {
    lines.push(sections.join('\n\n'), '')
  }
  if (view.sources.length > 0) {
    lines.push('**来源**', '')
    for (const source of view.sources) {
      lines.push(
        `${source.index}. [${linkText(source.title || source.url)}](<${source.url}>)`
      )
    }
    lines.push('')
  }
  if (sections.length === 0) {
    const failure = describeFailure(message)
    if (failure) {
      lines.push(`> ${failure}`, '')
    }
  }
  return lines.join('\n').trimEnd()
}

/** 当前分支的完整对话导出为 Markdown；思考过程不导出，引用编号保留并在末尾列出链接。 */
export const sessionToMarkdown = (session: Session): string => {
  const title = session.title || translate('untitledChat')
  const messages = getVisibleMessages(session)
  const rounds = messages.filter((message) => message.role === 'user').length
  const header = [
    `# ${title}`,
    '',
    `> 导出自 PocketSeek · ${formatTime(Date.now())}`,
    `> 共 ${rounds} 轮对话`,
    '',
    '---',
    '',
    '',
  ]
  const body = messages
    .map((message) => (message.role === 'user' ? userSection(message) : assistantSection(message)))
    .filter(Boolean)
    .join('\n\n---\n\n')
  return `${header.join('\n')}${body || '（空对话）'}\n`
}

/** 文件名去掉系统不允许的字符，并限制长度 */
export const sessionMarkdownFileName = (session: Session): string => {
  const title = inline(session.title || translate('untitledChat'))
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  const day = formatDate(Date.now()) ?? ''
  return `pocketseek-${title || '对话'}-${day}.md`
}

export const downloadSessionMarkdown = (session: Session) => {
  const blob = new Blob([sessionToMarkdown(session)], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = sessionMarkdownFileName(session)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'
export type ExportOutcome = 'downloaded' | 'shared' | 'cancelled' | 'failed'

const isCancelled = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    /cancel/i.test(String((error as { message?: unknown }).message))
  )
}

/**
 * 导出 Markdown：浏览器直接下载；
 * Android 壳内 WebView 不支持 blob 下载，写入缓存文件后打开系统分享面板，由用户保存到文件 App。
 */
export const exportSessionMarkdown = async (session: Session): Promise<ExportOutcome> => {
  const text = sessionToMarkdown(session)
  if (isNativeShell()) {
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ])
      const file = await Filesystem.writeFile({
        path: sessionMarkdownFileName(session),
        data: text,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
      await Share.share({
        title: session.title || translate('untitledChat'),
        url: file.uri,
        dialogTitle: translate('sessionMenuExportMarkdown'),
      })
      return 'shared'
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'failed'
    }
  }
  downloadSessionMarkdown(session)
  return 'downloaded'
}

/** 系统分享优先；不可用或被拒绝时回退到复制全文。 */
export const shareSession = async (session: Session): Promise<ShareOutcome> => {
  const text = sessionToMarkdown(session)
  const title = session.title || translate('untitledChat')
  if (isNativeShell()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, dialogTitle: translate('shareDialogTitle') })
      return 'shared'
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'failed'
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      if (isCancelled(error)) {
        return 'cancelled'
      }
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
