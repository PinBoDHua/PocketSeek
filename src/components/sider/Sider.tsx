import clsx from 'clsx'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFocusTrap } from '../base/useFocusTrap.js'
import { useTranslate } from '../../i18n/index.js'
import {
  IconChevronDownOutline14,
  IconChevronRightOutline14,
  IconPanelLeftOutline16,
  IconSettingsOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { BrandMark } from '../base/BrandMark.js'
import { usePins } from '../../services/chat/pins.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import {
  searchAllSessions,
  type MessageHit,
  type SearchResult,
} from '../../services/chat/search.js'
import {
  newChat,
  removeSession,
  removeSessions,
  selectSession,
  useChatStore,
} from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { jumpToMessage } from '../messages/messageJump.js'
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

/** 在片段中高亮所有命中词；大小写不敏感，查询为空时原样返回。 */
const highlightSnippet = (text: string, query: string): ReactNode => {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return text
  }
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let start = 0
  let index = lower.indexOf(keyword)
  while (index >= 0) {
    if (index > start) {
      parts.push(text.slice(start, index))
    }
    parts.push(<mark key={index}>{text.slice(index, index + keyword.length)}</mark>)
    start = index + keyword.length
    index = lower.indexOf(keyword, start)
  }
  if (start < text.length) {
    parts.push(text.slice(start))
  }
  return parts
}

/**
 * 展开的侧边栏：名称与收起按钮、开启新对话、会话搜索、置顶/按时间分组的会话列表、底部设置；
 * 多选时列表底部换成批量操作工具条。移动端放在抽屉里，收起按钮关闭抽屉。
 * 搜索同时匹配会话标题与消息正文，点消息结果可直接跳到对应位置。
 */
export const Sider = memo(function Sider({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const pinnedIds = usePins((state) => state.ids)
  const [now, setNow] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchPending, setSearchPending] = useState(false)
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
  // 搜索读全库而不是只读会话列表，防抖后执行；会话内容变化（重命名、删除、新消息）时重新搜索。
  // 依赖稳定签名而非数组引用；刷新期间保留旧结果，避免结果闪烁清空。
  const sessionsSignal = useMemo(
    () => sessions.map((session) => `${session.id}:${session.updatedAt}:${session.title}`).join('|'),
    [sessions]
  )
  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) {
      setSearchResult(null)
      setSearchPending(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setSearchPending(true)
    const timer = setTimeout(() => {
      void searchAllSessions(keyword, controller.signal)
        .then((result) => {
          if (!cancelled) {
            setSearchResult(result)
            setSearchPending(false)
          }
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console
          console.error('[search] local search failed', error)
          if (!cancelled) {
            setSearchResult({ titles: [], messages: [], truncated: false })
            setSearchPending(false)
          }
        })
    }, 200)
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, sessionsSignal])

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

  const openMessageHit = (hit: MessageHit) => {
    selectSession(hit.sessionId)
    jumpToMessage(hit.sessionId, hit.messageId)
    closeMobileSider()
  }

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.brand}>
          <BrandMark size={28} className={styles.brandMark} />
          <div className={styles.appName}>{t('appName')}</div>
        </div>
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
            <div className={styles.searchResults}>
              {searchPending || searchResult === null ? (
                <div className={styles.searchStatus} role="status" aria-live="polite">
                  {t('searchingMessages')}
                </div>
              ) : null}
              {searchResult && searchResult.titles.length > 0 ? (
                <>
                  <div className={styles.searchSectionLabel}>
                    {t('searchTitleMatches', { count: searchResult.titles.length })}
                  </div>
                  {searchResult.titles.map((hit) =>
                    renderItem({
                      id: hit.sessionId,
                      title: hit.title,
                      createdAt: hit.createdAt,
                      updatedAt: hit.updatedAt,
                    })
                  )}
                </>
              ) : null}
              {searchResult && searchResult.messages.length > 0 ? (
                <>
                  <div className={styles.searchSectionLabel}>
                    {t('searchMessageMatches', { count: searchResult.messages.length })}
                  </div>
                  {searchResult.messages.map((hit) => (
                    <button
                      key={`${hit.sessionId}-${hit.messageId}`}
                      type="button"
                      className={styles.searchHit}
                      onClick={() => openMessageHit(hit)}
                    >
                      <span className={styles.searchHitTop}>
                        <span className={styles.searchHitTitle}>{hit.title}</span>
                        <span className={styles.searchHitRole}>
                          {t(hit.role === 'user' ? 'searchHitRoleUser' : 'searchHitRoleAssistant')}
                        </span>
                      </span>
                      <span className={styles.searchHitSnippet}>
                        {highlightSnippet(hit.snippet, query)}
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
              {!searchPending &&
              searchResult &&
              searchResult.titles.length === 0 &&
              searchResult.messages.length === 0 ? (
                <div className={styles.searchEmpty}>{t('sessionSearchEmpty')}</div>
              ) : null}
              {searchResult?.truncated ? (
                <div className={styles.searchHint}>{t('searchResultLimitHint')}</div>
              ) : null}
            </div>
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
})

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = memo(function MobileSider() {
  const open = useMobileSider((state) => state.open)
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, drawerRef, closeMobileSider)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" tabIndex={-1}>
        <Sider mobile />
      </div>
    </>
  )
})
