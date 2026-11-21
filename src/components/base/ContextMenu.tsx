import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
 * 长按 / 右键手势：触摸设备长按 450ms 触发，桌面端右键触发。
 * 返回一组事件处理器，挂到消息容器等需要上下文菜单的元素上。
 */
export const useLongPress = (onLongPress: (position: MenuPosition) => void, delay = 450) => {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    origin.current = null
  }, [])

  useEffect(() => clear, [clear])

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) {
      clear()
      return
    }
    const touch = event.touches[0]
    origin.current = { x: touch.clientX, y: touch.clientY }
    timer.current = window.setTimeout(() => {
      timer.current = null
      // 长按打开自定义菜单前清掉系统文本选择，避免菜单与系统选择手柄同时出现
      window.getSelection()?.removeAllRanges()
      onLongPress({ x: touch.clientX, y: touch.clientY })
    }, delay)
  }

  const onTouchMove = (event: React.TouchEvent) => {
    const start = origin.current
    const touch = event.touches[0]
    if (
      start &&
      touch &&
      (Math.abs(touch.clientX - start.x) > 10 || Math.abs(touch.clientY - start.y) > 10)
    ) {
      clear()
    }
  }

  const onContextMenu = (event: React.MouseEvent) => {
    // 触屏设备用长按，避免右键菜单与长按菜单同时出现
    if (window.matchMedia('(hover: none)').matches) {
      return
    }
    event.preventDefault()
    onLongPress({ x: event.clientX, y: event.clientY })
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu,
  }
}

/**
 * 上下文菜单：贴在长按位置弹出，自动避开视口边缘；
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
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
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
