import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

export type ContextMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

export type MenuPosition = { x: number; y: number }

/**
 * 上下文菜单：贴在右键位置弹出，自动避开视口边缘；
 * 点外部、按 Esc 或滚动时关闭。
 */
export const ContextMenu = ({
  position,
  items,
  onClose,
}: {
  position: MenuPosition | null
  items: ContextMenuItem[]
  onClose: () => void
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!position) {
      setStyle(null)
      return
    }
    const menu = menuRef.current
    const width = menu?.offsetWidth ?? 176
    const height = menu?.offsetHeight ?? items.length * 40 + 8
    const margin = 8
    const left = Math.min(position.x, window.innerWidth - width - margin)
    const top = Math.min(position.y, window.innerHeight - height - margin)
    setStyle({ left: Math.max(margin, left), top: Math.max(margin, top) })
  }, [position, items.length])

  useEffect(() => {
    if (!position) {
      return
    }
    const onPointerDown = (event: Event) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        menuRef.current.contains(event.target)
      ) {
        return
      }
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [position, onClose])

  if (!position) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={style ?? { left: position.x, top: position.y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={item.danger ? `${styles.item} ${styles.danger}` : styles.item}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
