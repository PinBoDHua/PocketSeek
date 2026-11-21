import type { ReactNode } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16, IconSearchOutline16 } from '../base/icons.js'
import styles from './SessionSearch.module.css'

/** 会话搜索：输入即过滤，有内容时显示清除按钮；action 为右侧的多选入口 */
export const SessionSearch = ({
  value,
  onChange,
  onClear,
  action,
}: {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  action?: ReactNode
}) => {
  const t = useTranslate()
  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <span className={styles.icon}>
          <IconSearchOutline16 />
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder={t('sessionSearchPlaceholder')}
          aria-label={t('sessionSearchPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className={styles.clear}
            aria-label={t('sessionSearchClear')}
            onClick={onClear}
          >
            <IconCloseOutline16 />
          </button>
        ) : null}
      </div>
      {action}
    </div>
  )
}
