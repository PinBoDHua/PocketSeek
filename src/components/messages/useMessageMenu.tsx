import { useCallback, useState, type MouseEvent, type TouchEvent } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { getDraft, setDraftText } from '../../services/chat/drafts.js'
import { copyText } from '../../utils/clipboard.js'
import { IconQuoteOutline16 } from '../base/actionIcons.js'
import {
  ContextMenu,
  useLongPress,
  type ContextMenuItem,
  type MenuPosition,
} from '../base/ContextMenu.js'
import { IconCopyOutline16, IconEditOutline16, IconRefreshOutline16 } from '../base/icons.js'
import { showToast } from '../base/toastState.js'

/** 正文里的链接、代码块按钮等交互元素保留自己的行为，长按菜单不劫持它们 */
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"]'

const isInteractive = (target: EventTarget | null) =>
  target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null

const copyMessageText = (text: string) => {
  void copyText(text).then((ok) => {
    showToast({ key: ok ? 'copied' : 'copyFailed' })
  })
}

/** 以 Markdown 引用块插入草稿最前面，保留用户已经写好的内容。 */
const quoteMessageText = (sessionId: string, text: string) => {
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

/**
 * 消息长按 / 右键菜单：复制、引用（有正文时），以及重新生成（助手）或编辑（用户）。
 * 返回要挂到消息正文上的手势处理器和菜单元素（portal，放在组件任意位置即可）。
 */
export const useMessageMenu = ({
  sessionId,
  text,
  onEdit,
  onRegenerate,
}: {
  sessionId: string
  /** 该条消息可复制的纯文本；助手消息只传正文，不包含思考内容 */
  text: string
  /** 仅用户消息：进入编辑（禁用时不传） */
  onEdit?: () => void
  /** 仅助手消息：重新生成（streaming / busy / 安全拒绝时不传） */
  onRegenerate?: () => void
}) => {
  const t = useTranslate()
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const close = useCallback(() => setPosition(null), [])
  const longPress = useLongPress(setPosition)
  const items: ContextMenuItem[] = []
  if (text) {
    items.push({
      key: 'copy',
      label: t('contextMenuCopy'),
      icon: <IconCopyOutline16 />,
      onSelect: () => copyMessageText(text),
    })
    items.push({
      key: 'quote',
      label: t('contextMenuQuote'),
      icon: <IconQuoteOutline16 />,
      onSelect: () => quoteMessageText(sessionId, text),
    })
  }
  if (onRegenerate) {
    items.push({
      key: 'regenerate',
      label: t('contextMenuRegenerate'),
      icon: <IconRefreshOutline16 />,
      onSelect: onRegenerate,
    })
  }
  if (onEdit) {
    items.push({
      key: 'edit',
      label: t('contextMenuEdit'),
      icon: <IconEditOutline16 />,
      onSelect: onEdit,
    })
  }
  const handlers = {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      if (!isInteractive(event.target)) {
        longPress.onTouchStart(event)
      }
    },
    onTouchMove: longPress.onTouchMove,
    onTouchEnd: longPress.onTouchEnd,
    onTouchCancel: longPress.onTouchCancel,
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      if (!isInteractive(event.target)) {
        longPress.onContextMenu(event)
      }
    },
  }
  return {
    handlers,
    menu:
      position && items.length > 0 ? (
        <ContextMenu position={position} items={items} onClose={close} />
      ) : null,
  }
}
