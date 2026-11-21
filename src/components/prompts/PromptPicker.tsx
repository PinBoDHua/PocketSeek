import { useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { usePrompts } from '../../services/prompts.js'
import { useTranslate } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { IconPromptOutline16, IconSearchOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import { openSettings } from '../settings/settingsDialogState.js'
import styles from './PromptPicker.module.css'

/** 输入框里的快捷提示词面板：搜索、点选插入，或跳转到设置管理 */
export const PromptPicker = ({
  open,
  onClose,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  onInsert: (content: string) => void
}) => (open ? <PickerContent onClose={onClose} onInsert={onInsert} /> : null)

const PickerContent = ({
  onClose,
  onInsert,
}: {
  onClose: () => void
  onInsert: (content: string) => void
}) => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const prompts = usePrompts((state) => state.prompts)
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const filtered = keyword
    ? prompts.filter(
        (prompt) =>
          prompt.title.toLowerCase().includes(keyword) ||
          prompt.content.toLowerCase().includes(keyword)
      )
    : prompts
  const manage = () => {
    onClose()
    openSettings('prompts')
  }
  return (
    <Modal
      title={t('promptPickerTitle')}
      closable
      onClose={onClose}
      className={styles.picker}
      mainClassName={styles.main}
      footer={
        <Button variant="outlined" size="m" onClick={manage}>
          {t('promptPickerManage')}
        </Button>
      }
    >
      {prompts.length > 0 ? (
        <div className={styles.field}>
          <span className={styles.searchIcon}>
            <IconSearchOutline16 />
          </span>
          <input
            className={styles.input}
            value={query}
            placeholder={t('promptPickerSearch')}
            aria-label={t('promptPickerSearch')}
            autoFocus={!isMobile}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}
      <div className={styles.list}>
        {filtered.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            className={styles.item}
            onClick={() => onInsert(prompt.content)}
          >
            <span className={styles.itemTitle}>{prompt.title}</span>
            <span className={styles.itemContent}>{prompt.content}</span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <IconPromptOutline16 />
            <div className={styles.emptyTitle}>
              {t(prompts.length === 0 ? 'promptPickerEmpty' : 'promptPickerNoMatch')}
            </div>
            <div className={styles.emptyHint}>
              {t(prompts.length === 0 ? 'promptPickerEmptyHint' : 'promptPickerNoMatchHint')}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
