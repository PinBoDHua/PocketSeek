import { useTranslate } from '../../i18n/index.js'
import {
  exportSessionMarkdown,
  sessionToMarkdown,
  shareSession,
} from '../../services/chat/markdownExport.js'
import type { Session } from '../../services/chat/types.js'
import { copyText } from '../../utils/clipboard.js'
import { IconButton } from '../base/IconButton.js'
import {
  IconCopyOutline16,
  IconDownloadOutline16,
  IconEllipsisOutline16,
  IconShareOutline16,
} from '../base/icons.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { showToast } from '../base/toastState.js'

/**
 * 当前会话的更多操作：导出 Markdown / 系统分享 / 复制全文。
 * 导出在浏览器里直接下载；Android 壳内通过系统分享面板保存文件。
 */
export const SessionActionsMenu = ({
  session,
  align = 'end',
  size = 'm',
}: {
  session: Session
  align?: 'start' | 'end'
  size?: 'xs' | 'm' | 'xl'
}) => {
  const t = useTranslate()
  const options: MenuOption[] = [
    {
      key: 'export',
      label: t('sessionMenuExportMarkdown'),
      icon: <IconDownloadOutline16 />,
      onSelect: () => {
        void exportSessionMarkdown(session).then((outcome) => {
          if (outcome === 'downloaded') {
            showToast({ key: 'markdownExported' })
          } else if (outcome === 'failed') {
            showToast({ key: 'markdownExportFailed', type: 'error' })
          }
        })
      },
    },
    {
      key: 'share',
      label: t('sessionMenuShare'),
      icon: <IconShareOutline16 />,
      onSelect: () => {
        void shareSession(session).then((outcome) => {
          if (outcome === 'copied') {
            showToast({ key: 'shareCopied' })
          } else if (outcome === 'failed') {
            showToast({ key: 'shareFailed', type: 'error' })
          }
        })
      },
    },
    {
      key: 'copy',
      label: t('sessionMenuCopyAll'),
      icon: <IconCopyOutline16 />,
      onSelect: () => {
        void copyText(sessionToMarkdown(session)).then((ok) => {
          showToast(ok ? { key: 'copied' } : { key: 'copyFailed', type: 'error' })
        })
      },
    },
  ]
  return (
    <Menu options={options} align={align}>
      {({ toggle }) => (
        <IconButton
          size={size}
          icon={<IconEllipsisOutline16 />}
          tooltip={t('sessionActions')}
          tooltipPlacement="bottom"
          onClick={toggle}
        />
      )}
    </Menu>
  )
}
