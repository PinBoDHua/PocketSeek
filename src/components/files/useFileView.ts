import { useCallback, useEffect, useRef, useState } from 'react'
import { getFileViewType, isImage } from '../../services/attachments.js'
import { loadFile } from '../../services/chat/db.js'

const createViewUrl = (original: Blob, type: string) => {
  const blob = original.slice(0, original.size, type || 'application/octet-stream')
  if (type !== 'image/svg+xml') {
    return URL.createObjectURL(blob)
  }
  // SVG 缩略图用 data: 地址，单独打开图片时也与应用隔离。
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 草稿传 File，已发送的附件传 IndexedDB 原件 ID。 */
export const useFileView = (source: File | string, name: string) => {
  const type = getFileViewType(name)
  const image = isImage(type)
  // 草稿 File 已在内存中；历史图片等进入视口后再读 IndexedDB。
  const defer = image && typeof source === 'string'
  const [visible, setVisible] = useState(!defer)
  const observerRef = useRef<IntersectionObserver | null>(null)
  useEffect(() => {
    setVisible(!defer)
  }, [defer])
  const ref = useCallback(
    (element: Element | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!element) {
        return
      }
      if (!defer || typeof IntersectionObserver === 'undefined') {
        setVisible(true)
        return
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisible(true)
            observer.disconnect()
            observerRef.current = null
          }
        },
        { rootMargin: '200px' }
      )
      observer.observe(element)
      observerRef.current = observer
    },
    [defer]
  )
  useEffect(
    () => () => {
      observerRef.current?.disconnect()
    },
    []
  )
  const [state, setState] = useState<{ source: File | string; type: string; url: string | null }>()
  useEffect(() => {
    if (!visible) {
      return
    }
    let active = true
    const original = typeof source === 'string' ? loadFile(source) : Promise.resolve(source)
    const pending = original
      .then((blob) => (active && blob ? createViewUrl(blob, type) : null))
      .catch(() => null)
    void pending.then((url) => {
      if (active) {
        setState({ source, type, url })
      }
    })
    return () => {
      active = false
      void pending.then((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [source, type, visible])

  const url = state?.source === source && state.type === type ? state.url : undefined
  const openInTab = type === 'application/pdf' || (image && type !== 'image/svg+xml')
  const action = openInTab ? { target: '_blank', rel: 'noreferrer' } : { download: name }
  return { ref, url, image, link: url ? { href: url, ...action } : undefined }
}
