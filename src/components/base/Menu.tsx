import clsx from 'clsx'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismiss } from './anchored.js'
import styles from './Menu.module.css'

export type MenuOption = {
  key: string
  label: string
  icon: ReactNode
  danger?: boolean
  onSelect: () => void
}

/** 点击触发，向下展开；点外部或 Esc 关闭 */
export const Menu = ({
  options,
  align = 'start',
  children,
}: {
  options: MenuOption[]
  /** 默认左对齐；放在顶栏右侧入口时用 end 对齐 */
  align?: 'start' | 'end'
  children: (props: { open: boolean; toggle: () => void }) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const focusTrigger = () => {
    anchorRef.current
      ?.querySelector<HTMLElement>('button, [role="button"], [tabindex="0"]')
      ?.focus()
  }
  // 左对齐时再左移 5px，让菜单文字与触发元素图标对齐；右对齐镜像处理
  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLSpanElement, HTMLDivElement>(
    open,
    { align, alignOffset: align === 'end' ? 5 : -5, offset: 4 }
  )
  useDismiss(open, [anchorRef, floatingRef], (reason) => {
    setOpen(false)
    if (reason === 'escape') {
      focusTrigger()
    }
  })
  useEffect(() => {
    if (open) {
      optionRefs.current[0]?.focus()
    }
  }, [open])

  const choose = (option: MenuOption) => {
    setOpen(false)
    option.onSelect()
    focusTrigger()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = optionRefs.current.filter((item): item is HTMLDivElement => item !== null)
    if (items.length === 0) {
      return
    }
    const current = items.indexOf(document.activeElement as HTMLDivElement)
    const focusAt = (index: number) => {
      event.preventDefault()
      items[(index + items.length) % items.length].focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        focusAt(current + 1)
        break
      case 'ArrowUp':
        focusAt(current - 1)
        break
      case 'Home':
        focusAt(0)
        break
      case 'End':
        focusAt(items.length - 1)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const option = options[current]
        if (option) {
          choose(option)
        }
        break
      }
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        focusTrigger()
        break
      case 'Tab':
        event.preventDefault()
        setOpen(false)
        focusTrigger()
        break
      default:
        break
    }
  }

  return (
    <>
      <span ref={anchorRef} className={styles.anchor}>
        {children({ open, toggle: () => setOpen((value) => !value) })}
      </span>
      {open
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.menu}
              style={position ?? undefined}
              role="menu"
              onKeyDown={onKeyDown}
            >
              {options.map((option, index) => (
                <div
                  key={option.key}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  className={clsx(styles.option, option.danger && styles.danger)}
                  onClick={() => choose(option)}
                >
                  <span className={styles.icon}>{option.icon}</span>
                  {option.label}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
