import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconChevronDownOutline14,
  IconChevronRightOutline14,
  IconPanelLeftOutline16,
  IconSettingsOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { usePins } from '../../services/chat/pins.js'
import { groupSessions, searchSessions } from '../../services/chat/sessionGroups.js'
import { newChat, removeSession, removeSessions, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SelectionBar } from './SelectionBar.js'
import { SessionItem } from './SessionItem.js'
import { SessionSearch } from './SessionSearch.js'
import { useCollapsedSessionGroups } from './sessionGroupCollapse.js'
import styles from './Sider.module.css'

/**
 * 展开的侧边栏：名称与收起按钮、开启新对话、会话搜索、置顶/按时间分组的会话列表、底部设置；
 * 多选时列表底部换成批量操作工具条。移动端放在抽屉里，收起按钮关闭抽屉。
 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const pinnedIds = usePins((state) => state.ids)
  const [now, setNow] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const { collapsed, toggle: toggleGroup } = useCollapsedSessionGroups()
  const listRef = useRef<HTMLDivElement>(null)
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const hasSessions = sessions.length > 0
  const searching = query.trim().length > 0
  const groups = useMemo(
    () => groupSessions(sessions, now, t, pinnedIds),
    [sessions, now, t, pinnedIds]
  )
  const results = useMemo(
    () => (searching ? searchSessions(sessions, query, t, pinnedIds) : []),
    [searching, sessions, query, t, pinnedIds]
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // 会话被删除（含批量删除部分失败）后，从选中集合里去掉已不存在的会话
  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) {
        return current
      }
      const next = new Set(
        [...current].filter((id) => sessions.some((session) => session.id === id))
      )
      return next.size === current.size ? current : next
    })
  }, [sessions])

  // 过滤条件变化后把列表滚回顶部，避免停在空白位置
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [query])

  // 会话被全部删除后收起搜索框，避免留下一个无法清除的过滤条件
  useEffect(() => {
    if (sessions.length === 0) {
      setQuery('')
    }
  }, [sessions])

  const clearSelection = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const requestDelete = useCallback((session: SessionSummary) => {
    setDeleting(session)
  }, [])

  const updateQuery = (value: string) => {
    setQuery(value)
    // 切换搜索时退出多选并清空选择，避免跨搜索保留不可见的选中项
    if (selectMode) {
      clearSelection()
    }
  }

  const confirmDeleteSelected = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) {
      return
    }
    setBulkDeletePending(true)
    try {
      if (await removeSessions(ids)) {
        setBulkDeleteOpen(false)
        clearSelection()
      } else {
        setBulkDeleteOpen(false)
        showToast({ key: 'sessionDeleteFailed', type: 'error' })
      }
    } finally {
      setBulkDeletePending(false)
    }
  }

  const renderItem = (session: SessionSummary) => (
    <SessionItem
      key={session.id}
      session={session}
      active={session.id === activeId}
      pinned={pinnedSet.has(session.id)}
      selectMode={selectMode}
      selected={selectedIds.has(session.id)}
      onToggleSelect={toggleSelect}
      onDelete={requestDelete}
    />
  )

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        <IconButton
          size="m"
          icon={<IconPanelLeftOutline16 />}
          tooltip={t('collapseSiderbarButton')}
          tooltipPlacement="bottom"
          onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
        />
      </div>
      <button
        type="button"
        className={styles.newChat}
        onClick={() => {
          newChat()
          closeMobileSider()
          clearSelection()
        }}
      >
        <span className={styles.newChatIcon}>
          <NewChatIcon />
        </span>
        {t('newChat')}
      </button>
      {hasSessions ? (
        <SessionSearch
          value={query}
          onChange={updateQuery}
          onClear={() => updateQuery('')}
          action={
            selectMode ? null : (
              <button
                type="button"
                className={styles.selectToggle}
                onClick={() => {
                  setSelectMode(true)
                  setSelectedIds(new Set())
                }}
              >
                {t('selectSessions')}
              </button>
            )
          }
        />
      ) : null}
      <div className={clsx(styles.listWrap, hasSessions && styles.listWrapBelowSearch)}>
        <div ref={listRef} className={styles.list}>
          {searching ? (
            results.length > 0 ? (
              results.map(renderItem)
            ) : (
              <div className={styles.searchEmpty}>{t('sessionSearchEmpty')}</div>
            )
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsed.includes(group.key)
              return (
                <div key={group.key} className={styles.section}>
                  <button
                    type="button"
                    className={styles.sectionHeader}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? t('expandGroup') : t('collapseGroup')}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className={styles.sectionChevron}>
                      {isCollapsed ? <IconChevronRightOutline14 /> : <IconChevronDownOutline14 />}
                    </span>
                    {group.label}
                  </button>
                  {isCollapsed ? null : group.sessions.map(renderItem)}
                </div>
              )
            })
          )}
        </div>
      </div>
      {selectMode ? (
        <SelectionBar
          count={selectedIds.size}
          deleting={bulkDeletePending}
          onDelete={() => setBulkDeleteOpen(true)}
          onExit={clearSelection}
        />
      ) : (
        <div className={styles.bottom}>
          <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
            <span className={styles.settingsIcon}>
              <IconSettingsOutline16 />
            </span>
            <span className={styles.settingsLabel}>{t('settings')}</span>
          </button>
        </div>
      )}
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
      {bulkDeleteOpen ? (
        <Modal
          title={t('deleteSelectedConfirmTitle')}
          onClose={() => {
            if (!bulkDeletePending) {
              setBulkDeleteOpen(false)
            }
          }}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={bulkDeletePending}
                onClick={() => setBulkDeleteOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={bulkDeletePending}
                onClick={() => void confirmDeleteSelected()}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSelectedConfirmDescription', { count: selectedIds.size })}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
