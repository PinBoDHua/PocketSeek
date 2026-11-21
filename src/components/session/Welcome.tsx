import { useTranslate } from '../../i18n/index.js'
import { useIsMobile } from '../../app/viewport.js'
import { BrandMark } from '../base/BrandMark.js'
import { IconEditOutline16 } from '../base/icons.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import { setDraftText } from '../../services/chat/drafts.js'
import { sendMessage } from '../../services/chat/store.js'
import { usePrompts } from '../../services/prompts.js'
import { ensureApiKey, openSettings } from '../settings/settingsDialogState.js'
import styles from './Welcome.module.css'

/** 首页展示的快捷提问数量；更多的提示词从输入框的「提示词」入口调用 */
const QUICK_PROMPT_COUNT = 3

/** 新对话：问候语 + 快捷提问 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const prompts = usePrompts((state) => state.prompts)
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
        <div className={styles.hero}>
          <div className={styles.brandAvatar}>
            <BrandMark size={88} />
          </div>
          <div className={styles.brandName}>{t('appName')}</div>
          <div className={styles.greeting}>{t('welcomeMessageChat250808')}</div>
        </div>
        <div className={styles.prompts}>
          {prompts.slice(0, QUICK_PROMPT_COUNT).map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              className={styles.prompt}
              onClick={() => startPrompt(prompt.content)}
            >
              {prompt.title}
            </button>
          ))}
          <button
            type="button"
            className={styles.manage}
            onClick={() => openSettings('prompts')}
          >
            <IconEditOutline16 />
            {t(prompts.length === 0 ? 'promptWelcomeEmpty' : 'promptWelcomeManage')}
          </button>
        </div>
        <ChatInput sessionId={null} />
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}
