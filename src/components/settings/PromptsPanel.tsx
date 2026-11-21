import { useState } from 'react'
import {
  addPrompt,
  PROMPT_CONTENT_MAX,
  PROMPT_LIMIT,
  PROMPT_TITLE_MAX,
  removePrompt,
  resetPrompts,
  updatePrompt,
  usePrompts,
  type Prompt,
} from '../../services/prompts.js'
import { useTranslate } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import {
  IconEditOutline16,
  IconPromptOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import styles from './PromptsPanel.module.css'

/** 设置 → 提示词：新建、编辑、删除与恢复默认，保存后首页和输入框立即生效 */
export const PromptsPanel = () => {
  const t = useTranslate()
  const prompts = usePrompts((state) => state.prompts)
  const [editing, setEditing] = useState<Prompt | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Prompt | null>(null)
  const [resetting, setResetting] = useState(false)
  const full = prompts.length >= PROMPT_LIMIT
  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <div className={styles.introTitle}>{t('promptLibrary')}</div>
          <p className={styles.introDescription}>{t('promptLibraryDescription')}</p>
        </div>
        <Button
          variant="outlined"
          size="m"
          className={styles.newButton}
          disabled={full}
          onClick={() => setEditing('new')}
        >
          {t('promptNew')}
        </Button>
      </div>
      {prompts.length === 0 ? (
        <div className={styles.empty}>
          <IconPromptOutline16 />
          <div>{t('promptEmpty')}</div>
        </div>
      ) : (
        <div className={styles.list}>
          {prompts.map((prompt) => (
            <div key={prompt.id} className={styles.row}>
              <div className={styles.rowText}>
                <div className={styles.rowTitle}>{prompt.title}</div>
                <div className={styles.rowContent}>{prompt.content}</div>
              </div>
              <div className={styles.rowActions}>
                <IconButton
                  size="m"
                  icon={<IconEditOutline16 />}
                  tooltip={t('promptEdit')}
                  onClick={() => setEditing(prompt)}
                />
                <IconButton
                  size="m"
                  icon={<IconTrashOutline16 />}
                  tooltip={t('delete')}
                  onClick={() => setDeleting(prompt)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.footer}>
        <Button variant="outlined" size="m" onClick={() => setResetting(true)}>
          <IconRefreshOutline16 />
          {t('promptReset')}
        </Button>
        <span className={styles.count}>
          {t('promptCount', { count: prompts.length, limit: PROMPT_LIMIT })}
        </span>
      </div>
      {full ? (
        <p className={styles.limit}>{t('promptLimitReached', { count: PROMPT_LIMIT })}</p>
      ) : null}
      {editing ? (
        <PromptEditor
          prompt={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title={t('promptDeleteTitle')}
          description={t('promptDeleteDescription', { title: deleting.title })}
          confirmLabel={t('delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            removePrompt(deleting.id)
            setDeleting(null)
            showToast({ key: 'promptDeleted' })
          }}
        />
      ) : null}
      {resetting ? (
        <Confirm
          title={t('promptResetTitle')}
          description={t('promptResetDescription')}
          confirmLabel={t('promptReset')}
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            resetPrompts()
            setResetting(false)
            showToast({ key: 'promptResetDone' })
          }}
        />
      ) : null}
    </div>
  )
}

const PromptEditor = ({ prompt, onClose }: { prompt: Prompt | null; onClose: () => void }) => {
  const t = useTranslate()
  const [title, setTitle] = useState(prompt?.title ?? '')
  const [content, setContent] = useState(prompt?.content ?? '')
  const save = () => {
    const saved = prompt
      ? updatePrompt(prompt.id, title, content)
      : addPrompt(title, content) !== null
    if (!saved) {
      return
    }
    showToast({ key: prompt ? 'promptSaved' : 'promptAdded' })
    onClose()
  }
  return (
    <Modal
      title={t(prompt ? 'promptEdit' : 'promptNew')}
      onClose={onClose}
      className={styles.editor}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={!content.trim()} onClick={save}>
            {t('promptSave')}
          </Button>
        </>
      }
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('promptTitleLabel')}</span>
        <input
          className={styles.input}
          value={title}
          maxLength={PROMPT_TITLE_MAX}
          placeholder={t('promptTitlePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('promptContentLabel')}</span>
        <textarea
          className={styles.textarea}
          value={content}
          maxLength={PROMPT_CONTENT_MAX}
          rows={6}
          placeholder={t('promptContentPlaceholder')}
          autoFocus
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <div className={styles.hint}>{t('promptTitleHint')}</div>
    </Modal>
  )
}

const Confirm = ({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outlined" autoFocus onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button variant="dangerOutlined" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description}
    </Modal>
  )
}
