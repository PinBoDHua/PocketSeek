import { useTranslate } from '../../i18n/index.js'
import clsx from 'clsx'
import { memo } from 'react'
import { IconCloudOffOutline16, IconRefreshOutline16, IconWarningOutline16 } from '../base/icons.js'
import { describeReply } from '../../services/chat/describe.js'
import { canContinueReply } from '../../services/chat/reply.js'
import {
  cancelQueuedMessage,
  continueReply,
  regenerateReply,
  retryQueuedMessage,
} from '../../services/chat/store.js'
import { useOnlineStatus } from '../../services/network.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import type { AssistantMessage as AssistantMessageType } from '../../services/chat/types.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { IconButton } from '../base/IconButton.js'
import { Button } from '../base/Button.js'
import { showToast } from '../base/toastState.js'
import { Markdown } from '../markdown/Markdown.js'
import { SiteThumbnails } from '../search/SiteLogo.js'
import { toggleSearchPanel, useSearchPanel } from '../search/searchPanelState.js'
import { ReadAloudButton } from './ReadAloudButton.js'
import { CopyButton } from './CopyButton.js'
import { QuoteButton } from './QuoteButton.js'
import { MessageTime } from './MessageTime.js'
import { ReplyArea } from './ReplyArea.js'
import { UsageFootnote } from './UsageFootnote.js'
import { useMessageMenu } from './useMessageMenu.js'
import { useReplyView } from './useReplyView.js'
import {
  BranchSwitcher,
  type MessageVersions,
  type SelectMessageVersion,
} from './BranchSwitcher.js'
import styles from './AssistantMessage.module.css'

const TOP_UP_URL = 'https://platform.deepseek.com/top_up'

/** 只有待发送消息才订阅网络状态，避免每条历史消息都注册 online/offline 监听 */
const QueuedBanner = ({ onRetry, onCancel }: { onRetry: () => void; onCancel: () => void }) => {
  const t = useTranslate()
  const online = useOnlineStatus()
  return (
    <div className={styles.queued} role="status">
      <span className={styles.queuedIcon}>
        <IconCloudOffOutline16 />
      </span>
      <span className={styles.queuedText}>
        {t(online ? 'outboxQueuedOnline' : 'outboxQueuedOffline')}
      </span>
      <span className={styles.queuedActions}>
        <button
          type="button"
          className={styles.queuedAction}
          disabled={!online}
          onClick={onRetry}
        >
          {t('outboxSendNow')}
        </button>
        <button
          type="button"
          className={clsx(styles.queuedAction, styles.queuedCancel)}
          onClick={onCancel}
        >
          {t('outboxCancel')}
        </button>
      </span>
    </div>
  )
}

export const AssistantMessage = memo(function AssistantMessage({
  sessionId,
  message,
  isLast,
  streaming,
  busy,
  flash,
  versions,
  onSelectVersion,
}: {
  sessionId: string
  message: AssistantMessageType
  isLast: boolean
  streaming: boolean
  busy: boolean
  /** 搜索结果跳转后的短暂高亮 */
  flash: boolean
  versions: MessageVersions
  onSelectVersion: SelectMessageVersion
}) {
  const t = useTranslate()
  const view = useReplyView(message, streaming)
  const summaryEntry = `${message.id}-summary`
  // 只订阅「本条摘要是否激活」，切换面板时其余历史消息不重渲染
  const summaryActive = useSearchPanel((state) => state.entry === summaryEntry)
  const queued = message.status === 'queued'
  const notice = streaming || queued ? null : describeReply(message)
  // 安全拒绝：已下发的思考与正文按协议丢弃，只显示模板答复。
  const refused = message.stopReason === 'refusal'
  const answer = refused ? null : view.answer
  const responseText = [answer?.text, notice?.presentation === 'response' ? notice.text : null]
    .filter(Boolean)
    .join('\n\n')
  const copyText = responseText || notice?.text
  const waiting = streaming && view.steps.length === 0 && !view.answer && !message.thinking
  // 长按菜单只复制 / 引用正文，思考内容不进入剪贴板与草稿
  const answerText = answer?.text ?? ''
  const templateText = notice?.presentation === 'response' ? notice.text : ''
  const regenerate = () => {
    stopReadAloud()
    regenerateReply(sessionId, message.id)
  }
  const retryQueued = () => {
    if (!retryQueuedMessage()) {
      showToast({ key: 'outboxStillOfflineToast' })
    }
  }
  const cancelQueued = () => {
    void cancelQueuedMessage(sessionId, message.id).then((canceled) => {
      if (canceled) {
        showToast({ key: 'outboxCanceledToast' })
      }
    })
  }
  const menu = useMessageMenu({
    sessionId,
    text: answerText || templateText,
    // 与重新生成按钮保持一致：streaming / busy / 安全拒绝时不可用
    onRegenerate: busy || refused ? undefined : regenerate,
  })
  return (
    <div
      className={clsx(styles.message, flash && 'message-jump-flash')}
      data-message-id={message.id}
    >
      {refused ? null : (
        <ReplyArea
          message={message}
          view={view}
          streaming={streaming}
          hasResponse={!!responseText}
        />
      )}
      {answer || templateText ? (
        <div className={styles.longPressArea} {...menu.handlers}>
          {answer ? (
            <Markdown
              className="ds-assistant-message-main-content"
              content={answer.markdown}
              loading={streaming}
              cacheKey={message.id}
              disableLink={false}
              sources={view.sources}
            />
          ) : null}
          {templateText ? (
            <Markdown
              className="ds-assistant-message-main-content"
              content={templateText}
              loading={false}
              cacheKey={`${message.id}-template`}
              disableLink={false}
            />
          ) : null}
        </div>
      ) : null}
      {waiting ? (
        <div className={styles.waiting}>
          {[0, 1, 2].map((index) => (
            <span key={index} className={styles.waitingDot} />
          ))}
        </div>
      ) : null}
      {queued ? <QueuedBanner onRetry={retryQueued} onCancel={cancelQueued} /> : null}
      {notice && notice.presentation !== 'response' ? (
        <div className={styles.notice}>
          <IconWarningOutline16 />
          <span>
            {notice.text}
            {notice.action === 'apiKey' ? (
              <>
                {' '}
                <button
                  type="button"
                  className={styles.noticeAction}
                  onClick={() => openSettings('data')}
                >
                  {t('changeApiKey')}
                </button>
              </>
            ) : null}
            {notice.action === 'topUp' ? (
              <>
                {' '}
                <a
                  className={styles.noticeAction}
                  href={TOP_UP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('topUp')}
                </a>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
      {!streaming && !refused && view.searchResults.length > 0 ? (
        <div
          className={clsx(styles.summary, summaryActive && styles.summaryActive)}
          onClick={() => toggleSearchPanel(summaryEntry, view.searchResults)}
        >
          <SiteThumbnails sources={view.searchResults} />
          <span>
            {t(
              view.searchResults.length === 1 ? 'messageSearchSummary' : 'messageSearchSummaries',
              { count: view.searchResults.length }
            )}
          </span>
        </div>
      ) : null}
      {streaming || queued ? null : <UsageFootnote message={message} />}
      {streaming || queued ? null : (
        <div className={styles.bottom}>
          <MessageTime createdAt={message.createdAt} />
          <BranchSwitcher versions={versions} disabled={busy} onSelect={onSelectVersion} />
          <div className={clsx(styles.actions, isLast && styles.alwaysShow)}>
            {copyText ? <CopyButton text={copyText} /> : null}
            {answerText || templateText ? (
              <QuoteButton sessionId={sessionId} text={answerText || templateText} />
            ) : null}
            {responseText && !refused ? (
              <ReadAloudButton messageId={message.id} text={responseText} />
            ) : null}
            <IconButton
              icon={<IconRefreshOutline16 />}
              tooltip={t('regenerate')}
              tooltipPlacement="bottom"
              disabled={busy || refused}
              onClick={regenerate}
            />
          </div>
          {isLast && canContinueReply(message) ? (
            <Button
              variant="outlined"
              size="s"
              className={styles.continueButton}
              disabled={busy}
              onClick={() => {
                stopReadAloud()
                continueReply(sessionId, message.id)
              }}
            >
              {t('continueGenerating')}
            </Button>
          ) : null}
        </div>
      )}
      {menu.menu}
    </div>
  )
})
