import clsx from 'clsx'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  IconCheckOutline16,
  IconGlobeLanguageOutline14,
  IconPaperclipOutline16,
  IconPromptOutline14,
  IconSendOutline16,
  IconStopFill16,
  IconThinkOutline14,
} from '../base/icons.js'
import { IconCameraOutline16 } from '../base/brandIcons.js'
import { IconPauseFill16, IconPlayFill16 } from '../base/actionIcons.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { setEffort, setSearch, useSettings } from '../../services/settings.js'
import type { ThinkEffort } from '../../services/api/types.js'
import type { TranslationKey } from '../../i18n/index.js'
import { useIsMobile } from '../../app/viewport.js'
import { sendMessage, stopReply, useChatStore } from '../../services/chat/store.js'
import { useOnlineStatus } from '../../services/network.js'
import { useOutbox } from '../../services/chat/outbox.js'
import {
  addDraftFiles,
  consumeRestoredDraft,
  EMPTY_DRAFT,
  getDraft,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  setDraftText,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { hapticLight, hapticSelection, hapticWarning } from '../../services/haptics.js'
import { IconButton } from '../base/IconButton.js'
import { Tooltip } from '../base/Tooltip.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { DragMask, useFileDrop } from './DragMask.js'
import { showToast } from '../base/toastState.js'
import { ACCEPT, useUploads } from '../../services/attachments.js'
import { DraftAttachments } from './DraftAttachments.js'
import { useVoiceInput } from './useVoiceInput.js'
import { VoiceButton } from './VoiceButton.js'
import { Spectrum } from './Spectrum.js'
import { useTranslate } from '../../i18n/index.js'
import { PromptPicker } from '../prompts/PromptPicker.js'
import styles from './ChatInput.module.css'

/** 输入框：自适应高度的文本框 + 文件 + 模型与思考档位 + 智能搜索开关 + 语音输入 + 发送 / 停止 */
export const ChatInput = memo(function ChatInput({ sessionId }: { sessionId: string | null }) {
  // 切换目标时释放录音、转写和 DOM 状态；文字与附件由草稿服务保留。
  return <Input key={sessionId === null ? 'new' : `session:${sessionId}`} sessionId={sessionId} />
})

const EFFORT_LABELS: Record<ThinkEffort, TranslationKey> = {
  none: 'effortNoneName',
  low: 'effortLowName',
  high: 'effortHighName',
  max: 'effortMaxName',
}

const EFFORT_SHORT_LABELS: Record<ThinkEffort, TranslationKey> = {
  none: 'effortShortNone',
  low: 'effortShortLow',
  high: 'effortShortHigh',
  max: 'effortShortMax',
}

const EFFORTS: ThinkEffort[] = ['none', 'low', 'high', 'max']

/** 发送成功后的对勾反馈时长：只给一次轻量的确认，不弹 toast */
const SENT_FEEDBACK_MS = 600
/**
 * 新建会话发送成功的时间戳。从首页发送后输入框会随会话切换重建，
 * 新实例据此把剩余的对勾时长显示完，避免反馈在切换瞬间丢失。
 */
let lastSentAt = 0

/** Pro 不支持视觉输入：按 MIME 与扩展名双重判断，避免相机直拍的临时文件被漏掉 */
const isImageFile = (file: File) =>
  file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(file.name)

const Input = ({ sessionId }: { sessionId: string | null }) => {
  const t = useTranslate()
  const draft = useDrafts((state) => state.drafts.get(sessionId) ?? EMPTY_DRAFT)
  const { text, attachments } = draft
  const setText = (value: string) => setDraftText(sessionId, value)
  const draftReady = useUploads((state) => prepareDraftMessage(draft, state.tasks) !== null)
  const streaming = useChatStore(
    (state) => sessionId !== null && Object.hasOwn(state.streaming, sessionId)
  )
  const online = useOnlineStatus()
  // 上一条消息还在离线发件箱里：先等它发出或取消，避免多轮消息排队后上下文错位。
  const queued = useOutbox(
    (state) => sessionId !== null && state.entries.some((entry) => entry.sessionId === sessionId)
  )
  const effort = useSettings((state) => state.effort)
  const importingHistory = useChatStore((state) => state.importingHistory)
  const isMobile = useIsMobile()
  const search = useSettings((state) => state.search)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const togglesRef = useRef<HTMLDivElement>(null)
  const [sent, setSent] = useState(false)
  const [promptPickerOpen, setPromptPickerOpen] = useState(false)
  const sentTimerRef = useRef(0)

  const showSentFeedback = useCallback((duration: number) => {
    window.clearTimeout(sentTimerRef.current)
    setSent(true)
    sentTimerRef.current = window.setTimeout(() => {
      sentTimerRef.current = 0
      setSent(false)
    }, duration)
  }, [])

  // 新会话发送后输入框会随会话切换重建，由新实例把剩余的对勾时长显示完。
  // 新建会话（首页）本身不会收到跨实例反馈，避免切换页面时误显示。
  useEffect(() => {
    const remaining =
      sessionId === null || lastSentAt === 0 ? 0 : lastSentAt + SENT_FEEDBACK_MS - Date.now()
    lastSentAt = 0
    if (remaining > 0) {
      showSentFeedback(remaining)
    }
  }, [sessionId, showSentFeedback])

  // 草稿恢复提示：只在本次页面加载恢复过草稿的会话上出现一次
  useEffect(() => {
    if (consumeRestoredDraft(sessionId)) {
      showToast({ key: 'draftRestored' })
    }
  }, [sessionId])

  useEffect(() => () => window.clearTimeout(sentTimerRef.current), [])

  useLayoutEffect(() => {
    const toggles = togglesRef.current
    if (!toggles) {
      return
    }

    const updateLabels = () => {
      toggles.classList.remove(styles.collapsedToggles)
      toggles.classList.toggle(styles.collapsedToggles, toggles.scrollWidth > toggles.clientWidth)
    }

    updateLabels()
    const observer = new ResizeObserver(updateLabels)
    observer.observe(toggles)
    return () => observer.disconnect()
  }, [t])

  const acceptFiles = (files: File[]) => {
    if (files.length === 0 || useChatStore.getState().importingHistory || !ensureApiKey()) {
      return
    }
    // Pro 不支持图片输入：拦下图片并提示切换模型，其余文件照常加入草稿
    const model = useSettings.getState().model
    const accepted =
      model === 'deepseek-v4-pro' ? files.filter((file) => !isImageFile(file)) : files
    if (accepted.length < files.length) {
      showToast(t('visionUnsupported'))
    }
    if (accepted.length === 0) {
      return
    }
    const error = addDraftFiles(sessionId, accepted, useSettings.getState().apiKey ?? '')
    if (error) {
      showToast(error)
    }
  }
  const retryFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory && ensureApiKey()) {
        retryDraftAttachment(sessionId, id, useSettings.getState().apiKey ?? '')
      }
    },
    [sessionId]
  )
  const removeFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory) {
        removeDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const dragging = useFileDrop(acceptFiles)

  const effortOptions: MenuOption[] = EFFORTS.map((value) => ({
    key: value,
    label: t(EFFORT_LABELS[value]),
    icon: value === effort ? <IconCheckOutline16 /> : <span className={styles.menuSpacer} />,
    onSelect: () => {
      setEffort(value)
      hapticSelection()
    },
  }))

  /** 转写结果插入到光标处，并把光标移到插入内容之后 */
  const voice = useVoiceInput((transcript) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    setText(current.slice(0, start) + transcript + current.slice(end))
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      textarea?.setSelectionRange(start + transcript.length, start + transcript.length)
    })
  })

  // 欢迎页导入后会话 ID 不变，不能依赖卸载取消语音；订阅开始事件也覆盖快速完成的导入。
  const cancelVoice = voice.cancel
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.importingHistory && !previous.importingHistory) {
          cancelVoice()
        }
      }),
    [cancelVoice]
  )

  /** 提示词插入光标处；未聚焦时追加到末尾，避免恢复的草稿被插到开头 */
  const insertPrompt = (content: string) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const focused = textarea !== null && document.activeElement === textarea
    const start = focused ? (textarea.selectionStart ?? current.length) : current.length
    const end = focused ? (textarea.selectionEnd ?? current.length) : current.length
    const before = current.slice(0, start)
    const after = current.slice(end)
    const prefix = before && !before.endsWith('\n') ? '\n\n' : ''
    const suffix = after && !after.startsWith('\n') ? '\n' : ''
    const inserted = prefix + content + suffix
    setText(before + inserted + after)
    setPromptPickerOpen(false)
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      const caret = start + inserted.length
      textarea?.setSelectionRange(caret, caret)
    })
  }

  // 录音中由状态条与滚动波形接管输入区
  const recording = voice.status === 'recording'

  // 排队、上传中或上传失败的附件都留在输入框，全部上传成功后才能发送
  const canSend =
    !importingHistory && !streaming && !queued && voice.status === 'idle' && draftReady

  const send = () => {
    if (
      useChatStore.getState().importingHistory ||
      voice.status !== 'idle' ||
      !prepareDraftMessage(getDraft(sessionId), useUploads.getState().tasks)
    ) {
      return
    }
    // 文本与上传完成态由提交动作读取最新快照，不使用上一次渲染的草稿。
    if (!ensureApiKey()) {
      return
    }
    const result = sendMessage(sessionId)
    if (!result) {
      return
    }
    if (result === 'queued') {
      showToast({ key: 'outboxQueuedToast' })
    }
    // 发送成功：草稿已由 store 清空并同步 localStorage，按钮短暂显示对勾。
    // 只有从新建会话（首页）发送会重建输入框，需要记下时间让新实例接着显示。
    if (sessionId === null) {
      lastSentAt = Date.now()
    }
    showSentFeedback(SENT_FEEDBACK_MS)
    hapticLight()
    stopReadAloud()
    if (isMobile) {
      textareaRef.current?.blur()
    } else {
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={clsx(styles.wrapper, sessionId === null ? styles.home : styles.session)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          textareaRef.current?.focus({ preventScroll: true })
        }
      }}
    >
      <DraftAttachments items={attachments} onRetry={retryFile} onRemove={removeFile} />
      {online ? null : (
        <div className={styles.offlineHint} role="status">
          {t('offlineSendHint')}
        </div>
      )}
      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={clsx(styles.textarea, recording && styles.textareaHidden)}
          placeholder={t('chatInputPlaceholderChat')}
          rows={2}
          // 移动端不自动聚焦，避免一打开就弹出键盘
          autoFocus={!isMobile}
          disabled={importingHistory}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onMouseDown={(event) => {
            // 首次点击时手动聚焦，避免 Safari 把整个页面滚到输入框位置。
            if (isMobile && event.button === 0 && document.activeElement !== event.currentTarget) {
              event.preventDefault()
              const textarea = event.currentTarget
              const doc = document as Document & {
                caretPositionFromPoint?: (
                  x: number,
                  y: number
                ) => { offsetNode: Node; offset: number } | null
                caretRangeFromPoint?: (x: number, y: number) => Range | null
              }
              let offset: number | null = null
              const position = doc.caretPositionFromPoint?.(event.clientX, event.clientY)
              if (position?.offsetNode === textarea) {
                offset = position.offset
              } else {
                const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY)
                if (range?.startContainer === textarea) {
                  offset = range.startOffset
                }
              }
              textarea.focus({ preventScroll: true })
              if (offset !== null) {
                textarea.setSelectionRange(offset, offset)
              }
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files)
            if (files.length > 0) {
              event.preventDefault()
              acceptFiles(files)
            }
          }}
        />
        {recording ? (
          <div className={styles.voicePanel}>
            <span className={styles.voiceLabel}>
              {voice.paused ? t('voicePaused') : t('voiceInputTimer', { seconds: voice.seconds })}
            </span>
            <Spectrum getAnalyser={voice.getAnalyser} paused={voice.paused} />
            {voice.canPause ? (
              <button
                type="button"
                className={styles.voicePause}
                aria-label={voice.paused ? t('voiceResume') : t('voicePause')}
                onClick={voice.togglePause}
              >
                {voice.paused ? <IconPlayFill16 /> : <IconPauseFill16 />}
                {voice.paused ? t('voiceResume') : t('voicePause')}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={styles.mirror} aria-hidden>
          {`${text}\n`}
        </div>
      </div>
      <div className={styles.functionRow}>
        {/* 思考档位点击弹出菜单，智能搜索直接切换；模型切换在移动端顶栏 */}
        <div ref={togglesRef} className={styles.toggles}>
          <Menu options={effortOptions}>
            {({ open, toggle }) => (
              <button
                type="button"
                className={clsx(styles.toggle, (open || effort !== 'none') && styles.selected)}
                aria-label={t('effortTooltip')}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
              >
                <IconThinkOutline14 />
                <span className={styles.toggleLabel}>{t(EFFORT_SHORT_LABELS[effort])}</span>
              </button>
            )}
          </Menu>
          <Tooltip content={t('deactivatedSearchTooltip')}>
            <button
              type="button"
              className={clsx(styles.toggle, search && styles.selected)}
              aria-label={t('search')}
              aria-pressed={search}
              onClick={() => setSearch(!search)}
            >
              <IconGlobeLanguageOutline14 />
              <span className={styles.toggleLabel}>{t('searchShort')}</span>
            </button>
          </Tooltip>
          <Tooltip content={t('promptPickerTitle')}>
            <button
              type="button"
              className={styles.toggle}
              aria-label={t('promptPickerTitle')}
              aria-haspopup="dialog"
              disabled={importingHistory || voice.status !== 'idle'}
              onClick={() => setPromptPickerOpen(true)}
            >
              <IconPromptOutline14 />
              <span className={styles.toggleLabel}>{t('promptShort')}</span>
            </button>
          </Tooltip>
        </div>
        <div className={styles.right}>
          <VoiceButton
            status={voice.status}
            disabled={!voice.available}
            paused={voice.paused}
            onClick={() => {
              if (
                voice.status !== 'idle' ||
                (!useChatStore.getState().importingHistory && ensureApiKey())
              ) {
                void voice.toggle()
              }
            }}
          />
          {isMobile ? (
            <IconButton
              size="m"
              tone="primary"
              icon={<IconCameraOutline16 />}
              tooltip={t('camera')}
              disabled={importingHistory}
              onClick={() => ensureApiKey() && cameraInputRef.current?.click()}
            />
          ) : null}
          <IconButton
            size="m"
            tone="primary"
            icon={<IconPaperclipOutline16 />}
            tooltip={t('uploadFile')}
            disabled={importingHistory}
            onClick={() => ensureApiKey() && fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={ACCEPT}
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          {sent ? (
            <button
              type="button"
              className={clsx(styles.sendButton, styles.sent)}
              aria-label={t('send')}
              disabled
            >
              <IconCheckOutline16 />
            </button>
          ) : streaming && sessionId ? (
            <button
              type="button"
              className={styles.sendButton}
              aria-label={t('chatInputStopButtonTooltip')}
              onClick={() => {
                stopReadAloud()
                hapticWarning()
                stopReply(sessionId)
              }}
            >
              <IconStopFill16 />
            </button>
          ) : (
            <button
              type="button"
              className={clsx(styles.sendButton, !canSend && styles.disabled)}
              aria-label={t('send')}
              aria-disabled={!canSend}
              onClick={send}
            >
              <IconSendOutline16 />
            </button>
          )}
        </div>
      </div>
      {dragging ? <DragMask /> : null}
      <PromptPicker
        open={promptPickerOpen}
        onClose={() => setPromptPickerOpen(false)}
        onInsert={insertPrompt}
      />
    </div>
  )
}
