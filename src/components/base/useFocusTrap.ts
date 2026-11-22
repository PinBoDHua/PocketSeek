import { useEffect, useRef, type RefObject } from 'react'

/** 全屏面板/抽屉的焦点管理：初始聚焦、Tab 陷阱、Esc 关闭、关闭后还原焦点。 */
export const useFocusTrap = (
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) {
      return
    }
    const container = containerRef.current
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0)
    const first = focusables()[0]
    ;(first ?? container)?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        container?.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const current = document.activeElement
      const inside = current instanceof Node && container?.contains(current)
      if (event.shiftKey) {
        if (current === firstItem || current === container || !inside) {
          event.preventDefault()
          lastItem.focus()
        }
      } else if (current === lastItem || !inside) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [active, containerRef])
}
