import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { useIsMobile } from '../../app/viewport.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import { setDraftText } from '../../services/chat/drafts.js'
import { sendMessage } from '../../services/chat/store.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import styles from './Welcome.module.css'

/** 空态快捷提问：点一下直接开聊，避免对着空输入框发呆 */
const QUICK_PROMPTS: TranslationKey[] = [
  'quickPromptReport',
  'quickPromptExplain',
  'quickPromptTranslate',
]

/** 新对话：问候语 + 快捷提问 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const startPrompt = (text: string) => {
    if (!ensureApiKey()) {
      return
    }
    setDraftText(null, text)
    sendMessage(null)
  }
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.greeting}>{t('welcomeMessageChat250808')}</div>
        <div className={styles.prompts}>
          {QUICK_PROMPTS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.prompt}
              onClick={() => startPrompt(t(key))}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <ChatInput sessionId={null} />
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}
