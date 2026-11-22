import clsx from 'clsx'
import { memo, useState, type KeyboardEvent } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCheckOutline16,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { IconPinFill16, IconPinOutline16 } from '../base/actionIcons.js'
import { renameSession, selectSession } from '../../services/chat/store.js'
import { togglePin } from '../../services/chat/pins.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  pinned,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  pinned: boolean
  /** 多选态：点击条目切换选中，不进入会话，也不显示条目菜单 */
  selectMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onDelete: (session: SessionSummary) => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const displayTitle = session.title || t('untitledChat')

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  const activate = () => {
    if (selectMode) {
      onToggleSelect(session.id)
      return
    }
    selectSession(session.id)
    closeMobileSider()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 只处理会话行本身；重命名输入框与“更多”按钮有各自的键盘行为。
    if (event.target !== event.currentTarget) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  }

  return (
    <div
      className={clsx(styles.item, active && styles.active)}
      role="button"
      tabIndex={0}
      aria-current={active ? 'page' : undefined}
      aria-pressed={selectMode ? selected : undefined}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {pinned ? (
        <span className={styles.pinMark} aria-hidden>
          <IconPinFill16 />
        </span>
      ) : null}
      <div className={styles.title}>{displayTitle}</div>
      {selectMode ? (
        <span className={clsx(styles.check, selected && styles.checked)} aria-hidden>
          {selected ? <IconCheckOutline16 /> : null}
        </span>
      ) : (
        <div className={styles.action} onClick={(event) => event.stopPropagation()}>
          <Menu
            options={[
              {
                key: 'pin',
                label: pinned ? t('unpinSession') : t('pinSession'),
                icon: pinned ? <IconPinFill16 /> : <IconPinOutline16 />,
                onSelect: () => togglePin(session.id),
              },
              {
                key: 'rename',
                label: t('sessionItemMenuRenameOption'),
                icon: <IconEditOutline16 />,
                onSelect: () => setEditing(true),
              },
              {
                key: 'delete',
                label: t('delete'),
                icon: <IconTrashOutline16 />,
                danger: true,
                onSelect: () => onDelete(session),
              },
            ]}
          >
            {({ open, toggle }) => (
              <IconButton
                icon={<IconEllipsisOutline16 />}
                aria-label={t('more')}
                aria-expanded={open}
                onClick={toggle}
              />
            )}
          </Menu>
        </div>
      )}
    </div>
  )
})
