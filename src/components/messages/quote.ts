import { getDraft, setDraftText } from '../../services/chat/drafts.js'
import { showToast } from '../base/toastState.js'

/** 以 Markdown 引用块插入草稿最前面，保留用户已经写好的内容。 */
export const quoteMessageText = (sessionId: string, text: string) => {
  const content = text.trim()
  if (!content) {
    showToast({ key: 'quoteUnavailable' })
    return
  }
  const quoted = content
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
    .join('\n')
  setDraftText(sessionId, `${quoted}\n\n${getDraft(sessionId).text}`)
}
