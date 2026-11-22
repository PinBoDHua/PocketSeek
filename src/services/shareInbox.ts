import { registerPlugin } from '@capacitor/core'
import type { TranslationMessage } from '../i18n/index.js'
import { showToast } from '../components/base/toastState.js'
import { ensureApiKey } from '../components/settings/settingsDialogState.js'
import { isAcceptedExt, resolveMimeType } from './attachments.js'
import { addDraftFiles, getDraft, setDraftText } from './chat/drafts.js'
import { useChatStore } from './chat/store.js'
import { useSettings } from './settings.js'
import { isNativeShell } from '../native.js'

type SharedText = { type: 'text'; text: string }
type SharedImage = { type: 'image'; name: string; mimeType: string; data: string }
type SharedItem = SharedText | SharedImage
type SharePayload = { items: SharedItem[]; skipped?: number; hasMore?: boolean }

type ShareReceiverPlugin = {
  getPending: () => Promise<SharePayload | undefined>
}

const shareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver')

const SHARE_TARGET_PARAM = 'share-target'
const NATIVE_SHARE_EVENT = 'pocketseekShare'
const SHARE_TARGET_KEYS = ['title', 'text', 'url'] as const

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/apng': 'apng',
  'image/x-icon': 'ico',
}

const appendText = (sessionId: string | null, text: string) => {
  if (!text) {
    return
  }
  const current = getDraft(sessionId).text
  setDraftText(sessionId, current.trim() ? `${current.trimEnd()}\n\n${text}` : text)
}

const SHARE_CACHE = 'pocketseek-share'

/** PWA 分享目标使用 POST；Service Worker 把表单暂存到 Cache，这里读取后立即删除。 */
const readShareTarget = async (): Promise<string> => {
  const params = new URLSearchParams(window.location.search)
  if (!params.has(SHARE_TARGET_PARAM)) {
    return ''
  }
  let values: string[] = []
  try {
    const cache = await caches.open(SHARE_CACHE)
    const cached = await cache.match('latest')
    if (cached) {
      const data = (await cached.json()) as { title?: unknown; text?: unknown; url?: unknown }
      values = [data.title, data.text, data.url].filter(
        (value): value is string => typeof value === 'string'
      )
      await cache.delete('latest')
    }
  } catch {
    // 非安全上下文或旧浏览器没有 Cache API，退回读取查询参数。
  }
  if (values.every((value) => !value.trim())) {
    values = SHARE_TARGET_KEYS.map((key) => params.get(key) ?? '')
  }
  const parts: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (value && !parts.some((part) => part === value || part.includes(value))) {
      parts.push(value)
    }
  }
  history.replaceState(null, '', window.location.pathname + window.location.hash)
  return parts.join('\n')
}

/** 系统分享的文件名可能没有扩展名（或扩展名不在白名单），按 MIME 补一个可上传的后缀。 */
const normalizeImageName = (image: SharedImage) => {
  const raw = image.name?.trim() || 'share-image'
  if (isAcceptedExt(raw)) {
    return raw
  }
  const ext = EXT_BY_MIME[image.mimeType?.toLowerCase() ?? '']
  if (!ext) {
    return null
  }
  return `${raw.replace(/[\\/:*?"<>|]+/g, '-')}.${ext}`
}

const decodeImage = (image: SharedImage): File | null => {
  const name = normalizeImageName(image)
  if (!name) {
    return null
  }
  try {
    const binary = atob(image.data)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    const mimeType = image.mimeType || resolveMimeType(new File([], name))
    return new File([bytes], name, { type: mimeType })
  } catch {
    return null
  }
}

/** 导入历史期间先暂存，替换完成后再并入草稿，避免被 clearAllDrafts 清掉。 */
const deferredShares: SharePayload[] = []

const applySharedPayloadNow = (payload: SharePayload) => {
  const state = useChatStore.getState()
  const sessionId = state.activeId
  const texts = payload.items
    .filter((item): item is SharedText => item.type === 'text')
    .map((item) => item.text.trim())
    .filter(Boolean)
  appendText(sessionId, texts.join('\n'))

  const images = payload.items.filter((item): item is SharedImage => item.type === 'image')
  let skipped = payload.skipped ?? 0
  let added = 0
  let notice: TranslationMessage | null = null

  if (images.length > 0) {
    const { model, apiKey } = useSettings.getState()
    if (model === 'deepseek-v4-pro') {
      notice = { key: 'visionUnsupported' }
    } else if (!apiKey) {
      ensureApiKey()
      notice = { key: 'shareImagesNeedKey' }
    } else {
      const files = images
        .map((image) => decodeImage(image))
        .filter((file): file is File => file !== null)
      skipped += images.length - files.length
      if (files.length > 0) {
        const error = addDraftFiles(sessionId, files, apiKey)
        if (error) {
          notice = error
        } else {
          added = files.length
        }
      }
    }
  }

  if (notice) {
    showToast(notice)
  } else if (skipped > 0) {
    showToast({ key: 'shareImagesSkipped', params: { count: skipped } })
  } else if (added > 0) {
    showToast({ key: 'shareReceivedImages', params: { count: added } })
  } else if (texts.length > 0) {
    showToast({ key: 'shareReceivedText' })
  }
}

export const applySharedPayload = (payload: SharePayload) => {
  if (useChatStore.getState().importingHistory) {
    deferredShares.push(payload)
    if (deferredShares.length > 20) {
      deferredShares.shift()
    }
    return
  }
  applySharedPayloadNow(payload)
}

const flushDeferredShares = () => {
  while (deferredShares.length > 0 && !useChatStore.getState().importingHistory) {
    const payload = deferredShares.shift()
    if (payload) {
      applySharedPayloadNow(payload)
    }
  }
}

let pulling = false
let pullAgain = false

/** 原生侧把分享内容排队；这里一次取空，处理期间又到的分享由下一轮补取。 */
const pullNativeShare = async () => {
  if (!isNativeShell()) {
    return
  }
  if (pulling) {
    pullAgain = true
    return
  }
  pulling = true
  try {
    do {
      pullAgain = false
      for (let guard = 0; guard < 50; guard += 1) {
        const payload = await shareReceiver.getPending()
        if (payload && (payload.items.length > 0 || (payload.skipped ?? 0) > 0)) {
          applySharedPayload(payload)
        }
        if (!payload?.hasMore) {
          break
        }
      }
    } while (pullAgain)
  } catch {
    // 旧原生壳没有该插件时静默跳过
  } finally {
    pulling = false
  }
}

let targetConsumed = false

/** 应用启动时接收 PWA 分享目标，并订阅 Android 原生壳的分享事件。 */
export const initShareInbox = () => {
  if (!targetConsumed) {
    targetConsumed = true
    void readShareTarget().then((text) => {
      if (text) {
        applySharedPayload({ items: [{ type: 'text', text }] })
      }
    })
  }
  const unsubscribe = useChatStore.subscribe((state, previous) => {
    if (previous.importingHistory && !state.importingHistory) {
      flushDeferredShares()
    }
  })
  if (!isNativeShell()) {
    return unsubscribe
  }
  const onNativeShare = () => {
    void pullNativeShare()
  }
  window.addEventListener(NATIVE_SHARE_EVENT, onNativeShare)
  void pullNativeShare()
  return () => {
    unsubscribe()
    window.removeEventListener(NATIVE_SHARE_EVENT, onNativeShare)
  }
}
