import { useTranslate } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import styles from './SelectionBar.module.css'

/** 多选底部工具条：已选数量、删除所选、退出多选 */
export const SelectionBar = ({
  count,
  deleting,
  onDelete,
  onExit,
}: {
  count: number
  deleting: boolean
  onDelete: () => void
  onExit: () => void
}) => {
  const t = useTranslate()
  return (
    <div className={styles.bar}>
      <div className={styles.summary}>
        <span className={styles.count}>{t('selectedSessions', { count })}</span>
        <button type="button" className={styles.exit} onClick={onExit}>
          {t('exitSelectSessions')}
        </button>
      </div>
      <Button variant="danger" size="l" block disabled={deleting || count === 0} onClick={onDelete}>
        {t('deleteSelectedSessions')}
      </Button>
    </div>
  )
}
