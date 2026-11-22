import { memo, useRef } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { useIsMobile } from '../../app/viewport.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { useFocusTrap } from '../base/useFocusTrap.js'
import { closeSearchPanel, useSearchPanel } from './searchPanelState.js'
import { SourceCard } from './SourceCard.js'
import styles from './SearchPanel.module.css'

/** 右侧「搜索结果」面板 */
export const SearchPanel = memo(function SearchPanel() {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const entry = useSearchPanel((state) => state.entry)
  const sources = useSearchPanel((state) => state.sources)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(Boolean(entry) && isMobile, panelRef, closeSearchPanel)
  if (!entry) {
    return null
  }
  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile ? true : undefined}
      tabIndex={-1}
    >
      <div className={styles.header}>
        <div role="heading" className={styles.title}>
          {t('searchResult')}
        </div>
        <IconButton
          icon={<IconCloseOutline16 />}
          aria-label={t('close')}
          onClick={closeSearchPanel}
        />
      </div>
      <div className={styles.content}>
        {sources.map((source) => (
          <SourceCard key={source.url} source={source} className={styles.item} />
        ))}
      </div>
    </aside>
  )
})
