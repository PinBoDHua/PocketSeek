import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import styles from './AttachmentPreview.module.css'

/**
 * 草稿图片的全屏预览：深色半透明遮罩 + 按比例居中的原图。
 * 点遮罩或按 Esc 关闭；Blob URL 在挂载时创建、卸载时释放。
 */
export const AttachmentPreview = ({
  file,
  name,
  onClose,
}: {
  file: File
  /** 图片文件名，同时作为无障碍名称与浏览器备用文案 */
  name: string
  onClose: () => void
}) => {
  const t = useTranslate()
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  // 移动端打开预览前收起输入法，避免键盘压缩视口后图片被遮挡
  useEffect(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      active.blur()
    }
  }, [])

  // 用 ref 保存回调，Esc 监听只注册一次，不随父组件重渲染重新绑定
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('attachmentPreview')}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <img className={styles.image} src={url} alt={name} draggable={false} />
      <button type="button" className={styles.close} aria-label={t('close')} onClick={onClose}>
        <IconCloseOutline16 />
      </button>
    </div>,
    document.body
  )
}
