import clsx from 'clsx'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from './icons.js'
import { IconButton } from './IconButton.js'
import styles from './Modal.module.css'

/** 当前打开的弹窗，后打开的在末尾；叠放时 Esc 只关闭最上层 */
const openModals: object[] = []

/** 遮罩 + 居中卡片，Esc / 点遮罩关闭 */
export const Modal = ({
  title,
  children,
  footer,
  closable = false,
  className,
  mainClassName,
  onClose,
}: {
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** 标题栏右侧显示关闭按钮 */
  closable?: boolean
  className?: string
  /** 内容区的 class */
  mainClassName?: string
  onClose: () => void
}) => {
  const t = useTranslate()
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const contentRef = useRef<HTMLDivElement>(null)
  onCloseRef.current = onClose
  useEffect(() => {
    const token = {}
    openModals.push(token)
    const root = document.getElementById('root')
    if (openModals.length === 1) {
      root?.setAttribute('inert', '')
    }
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    contentRef.current?.focus()
    const focusables = () =>
      Array.from(
        contentRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (openModals.at(-1) !== token) {
        return
      }
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        contentRef.current?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && contentRef.current?.contains(active)
      if (event.shiftKey) {
        if (active === first || active === contentRef.current || !inside) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !inside) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      document.removeEventListener('keydown', onKeyDown)
      if (openModals.length === 0) {
        root?.removeAttribute('inert')
      }
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={contentRef}
        className={clsx(styles.content, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          {closable ? (
            <IconButton
              className={styles.close}
              tone="primary"
              icon={<IconCloseOutline16 />}
              aria-label={t('close')}
              onClick={onClose}
            />
          ) : null}
        </div>
        {children ? <div className={clsx(styles.main, mainClassName)}>{children}</div> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
