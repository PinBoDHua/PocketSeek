import clsx from 'clsx'
import { IconCheckOutline16, IconMenuOutline20, IconNewChatOutline20 } from '../base/icons.js'
import { IconModelOutline16 } from '../base/brandIcons.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { newChat } from '../../services/chat/store.js'
import { setModel, useSettings } from '../../services/settings.js'
import type { ChatModel } from '../../services/api/types.js'
import { IconButton } from '../base/IconButton.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

const MODEL_LABELS: Record<ChatModel, TranslationKey> = {
  'deepseek-flash': 'modelFlashName',
  'deepseek-v4-pro': 'modelProName',
}

const MODELS: ChatModel[] = ['deepseek-flash', 'deepseek-v4-pro']

/** 移动端顶栏：左侧菜单打开侧边栏；中间标题；右侧模型切换与新对话 */
export const MobileHeader = ({ title }: { title?: string }) => {
  const t = useTranslate()
  const model = useSettings((state) => state.model)
  const modelOptions: MenuOption[] = MODELS.map((value) => ({
    key: value,
    label: t(MODEL_LABELS[value]),
    icon: value === model ? <IconCheckOutline16 /> : <span className={styles.menuSpacer} />,
    onSelect: () => setModel(value),
  }))
  return (
    <div className={styles.header}>
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconMenuOutline20 />}
        aria-label={t('expandSiderbarButton')}
        onClick={openMobileSider}
      />
      <div className={styles.title}>{title ?? ''}</div>
      <Menu options={modelOptions}>
        {({ open, toggle }) => (
          <button
            type="button"
            className={clsx(styles.modelChip, open && styles.modelChipOpen)}
            aria-label={t('modelTooltip')}
            aria-haspopup="menu"
            onClick={toggle}
          >
            <IconModelOutline16 />
            <span>{t(model === 'deepseek-v4-pro' ? 'modelProShort' : 'modelFlashShort')}</span>
          </button>
        )}
      </Menu>
      {title === undefined ? null : (
        <IconButton
          size="xl"
          tone="primary"
          icon={<IconNewChatOutline20 />}
          aria-label={t('newChat')}
          onClick={newChat}
        />
      )}
    </div>
  )
}
