import clsx from 'clsx'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismiss } from './anchored.js'
import { IconCheckOutline16, IconChevronDownOutline14 } from './icons.js'
import styles from './Select.module.css'

export type SelectOption<T extends string> = { value: T; label: string; lang?: string }

/**
 * 胶囊形选择器：触发器高 36px、圆角 18px、浅灰底，下拉菜单选中项右侧打勾；
 * 点外部或 Esc 关闭。value 不匹配任何选项时触发器显示 placeholder。
 */
export const Select = <T extends string>({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  className,
  disabled = false,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const current = options.find((option) => option.value === value)
  // 菜单贴右侧展开，最多 320px 高，超出在菜单内滚动
  const { anchorRef, floatingRef, position } = useAnchoredPosition<
    HTMLButtonElement,
    HTMLDivElement
  >(open, { align: 'end', maxHeight: 320, minSpace: 160 })
  const focusTrigger = () => anchorRef.current?.focus()
  // Esc 只关菜单，不让外层弹窗一起关闭
  useDismiss(
    open,
    [anchorRef, floatingRef],
    (reason) => {
      setOpen(false)
      if (reason === 'escape') {
        focusTrigger()
      }
    },
    { captureEscape: true }
  )
  useEffect(() => {
    if (!open) {
      return
    }
    const selected = options.findIndex((option) => option.value === value)
    optionRefs.current[selected >= 0 ? selected : 0]?.focus()
  }, [open, options, value])

  const choose = (option: SelectOption<T>) => {
    setOpen(false)
    onChange(option.value)
    focusTrigger()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = optionRefs.current.filter((item): item is HTMLDivElement => item !== null)
    if (items.length === 0) {
      return
    }
    const active = items.indexOf(document.activeElement as HTMLDivElement)
    const focusAt = (index: number) => {
      event.preventDefault()
      items[(index + items.length) % items.length].focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        focusAt(active + 1)
        break
      case 'ArrowUp':
        focusAt(active - 1)
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
        const option = options[active]
        if (option) {
          choose(option)
        }
        break
      }
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
      <button
        ref={anchorRef}
        type="button"
        className={clsx(styles.trigger, open && styles.open, className)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {current ? (
          <span lang={current.lang}>{current.label}</span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <span className={styles.arrow}>
          <IconChevronDownOutline14 />
        </span>
      </button>
      {open && !disabled
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.menu}
              style={position ?? undefined}
              role="listbox"
              aria-label={ariaLabel}
              onKeyDown={onKeyDown}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  role="option"
                  tabIndex={-1}
                  lang={option.lang}
                  aria-selected={option.value === value}
                  className={styles.option}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? <IconCheckOutline16 /> : null}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
