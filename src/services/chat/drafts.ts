import { create } from 'zustand'
import type { TranslationMessage } from '../../i18n/index.js'
import { createId } from '../../utils/id.js'
import {
  cancelUpload,
  isImage,
  resolveMimeType,
  seedUploadTask,
  uploadAttachment,
  validateFiles,
  type UploadTask,
} from '../attachments.js'
import { loadFile } from './db.js'
import type { FileAttachment } from './types.js'

export type DraftAttachment = {
  /** 本地标识，也是 IndexedDB 原件与上传任务的 key */
  id: string
  file: File
  isImage: boolean
}

type Draft = { text: string; attachments: DraftAttachment[] }

export const EMPTY_DRAFT: Draft = { text: '', attachments: [] }

/** 草稿只保存在本次页面的内存中，独立于会话详情缓存；null 是新对话的草稿。 */
export const useDrafts = create<{ drafts: Map<string | null, Draft> }>(() => ({
  drafts: new Map(),
}))

/** 文字草稿额外持久化到 localStorage：刷新、切后台后回到页面可恢复（附件原件不持久化） */
const STORAGE_PREFIX = 'pocketseek:draft:'
const storageKey = (sessionId: string | null) => `${STORAGE_PREFIX}${sessionId ?? 'new'}`

const persistText = (sessionId: string | null, text: string) => {
  try {
    if (text) {
      localStorage.setItem(storageKey(sessionId), text)
    } else {
      localStorage.removeItem(storageKey(sessionId))
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 记录本次页面加载时恢复过草稿的会话，供输入框只提示一次 */
const restoredDrafts = new Set<string | null>()

const hydrateDrafts = () => {
  const entries = new Map<string | null, Draft>()
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(STORAGE_PREFIX)) {
        continue
      }
      const text = localStorage.getItem(key) ?? ''
      if (!text.trim()) {
        continue
      }
      const raw = key.slice(STORAGE_PREFIX.length)
      const sessionId = raw === 'new' ? null : raw
      entries.set(sessionId, { text, attachments: [] })
      restoredDrafts.add(sessionId)
    }
  } catch {
    return
  }
  if (entries.size === 0) {
    return
  }
  useDrafts.setState((state) => {
    const drafts = new Map(state.drafts)
    for (const [sessionId, draft] of entries) {
      if (!drafts.has(sessionId)) {
        drafts.set(sessionId, draft)
      }
    }
    return { drafts }
  })
}

hydrateDrafts()

/** 本次打开页面时是否恢复过该会话的草稿；消费后不再重复提示 */
export const consumeRestoredDraft = (sessionId: string | null): boolean => {
  if (!restoredDrafts.has(sessionId)) {
    return false
  }
  restoredDrafts.delete(sessionId)
  return true
}

export const getDraft = (sessionId: string | null): Draft =>
  useDrafts.getState().drafts.get(sessionId) ?? EMPTY_DRAFT

const updateDraft = (sessionId: string | null, update: (draft: Draft) => Draft) => {
  const draft = update(useDrafts.getState().drafts.get(sessionId) ?? EMPTY_DRAFT)
  useDrafts.setState((state) => {
    const drafts = new Map(state.drafts)
    if (draft.text || draft.attachments.length > 0) {
      drafts.set(sessionId, draft)
    } else {
      drafts.delete(sessionId)
    }
    return { drafts }
  })
  persistText(sessionId, draft.text)
}

export const setDraftText = (sessionId: string | null, text: string) =>
  updateDraft(sessionId, (draft) => ({ ...draft, text }))

const upload = (attachment: DraftAttachment, apiKey: string) => {
  // 上传任务负责记录错误，输入框的附件卡片展示失败及重试入口。
  void uploadAttachment(
    apiKey,
    attachment.id,
    attachment.file,
    attachment.file.name,
    attachment.isImage
  ).catch(() => {})
}

/** 整批校验通过后才加入草稿并开始上传。 */
export const addDraftFiles = (
  sessionId: string | null,
  files: File[],
  apiKey: string
): TranslationMessage | null => {
  if (files.length === 0) {
    return null
  }
  const error = validateFiles(files, getDraft(sessionId).attachments.length)
  if (error) {
    return error
  }
  const added = files.map(
    (file): DraftAttachment => ({
      id: createId(),
      file,
      isImage: isImage(resolveMimeType(file)),
    })
  )
  updateDraft(sessionId, (draft) => ({ ...draft, attachments: [...draft.attachments, ...added] }))
  added.forEach((attachment) => upload(attachment, apiKey))
  return null
}

export const retryDraftAttachment = (
  sessionId: string | null,
  attachmentId: string,
  apiKey: string
) => {
  const attachment = getDraft(sessionId).attachments.find((item) => item.id === attachmentId)
  if (attachment) {
    upload(attachment, apiKey)
  }
}

/** 发送按钮和实际提交共用规则：有内容，且全部附件已上传成功。 */
export const prepareDraftMessage = (draft: Draft, tasks: Record<string, UploadTask>) => {
  const text = draft.text.trim()
  if (!text && draft.attachments.length === 0) {
    return null
  }
  const files: (FileAttachment & { serverId: string; blob: Blob })[] = []
  for (const attachment of draft.attachments) {
    const task = tasks[attachment.id]
    if (task?.status !== 'done' || !task.serverId) {
      return null
    }
    files.push({
      id: attachment.id,
      serverId: task.serverId,
      name: attachment.file.name,
      size: attachment.file.size,
      isImage: attachment.isImage,
      mimeType: resolveMimeType(attachment.file),
      blob: attachment.file,
    })
  }
  return { text, files }
}

export const removeDraftAttachment = (sessionId: string | null, attachmentId: string) => {
  const attachment = getDraft(sessionId).attachments.find((item) => item.id === attachmentId)
  if (!attachment) {
    return
  }
  cancelUpload(attachment.id)
  updateDraft(sessionId, (draft) => ({
    ...draft,
    attachments: draft.attachments.filter((item) => item.id !== attachmentId),
  }))
}

/** 发送成功后原件与 serverId 已交给会话，保留上传完成态。 */
export const clearSentDraft = (sessionId: string | null) => {
  updateDraft(sessionId, () => EMPTY_DRAFT)
}

/** 删除会话或替换历史成功后，释放尚未发送的草稿及上传任务。 */
export const clearDraft = (sessionId: string | null) => {
  getDraft(sessionId).attachments.forEach((attachment) => cancelUpload(attachment.id))
  updateDraft(sessionId, () => EMPTY_DRAFT)
}

/**
 * 把已进入发件箱的消息附件放回草稿：从 IndexedDB 读回原件，沿用原 serverId，
 * 取消后可直接再次发送，不需要重新上传。返回恢复的数量。
 */
export const restoreDraftAttachments = async (
  sessionId: string | null,
  files: FileAttachment[]
): Promise<number> => {
  if (files.length === 0) {
    return 0
  }
  const existing = new Set(getDraft(sessionId).attachments.map((attachment) => attachment.id))
  const restored: DraftAttachment[] = []
  for (const file of files) {
    if (existing.has(file.id)) {
      continue
    }
    const blob = await loadFile(file.id).catch(() => null)
    if (!blob) {
      continue
    }
    restored.push({
      id: file.id,
      file: new File([blob], file.name, { type: file.mimeType || blob.type }),
      isImage: file.isImage,
    })
  }
  if (restored.length === 0) {
    return 0
  }
  updateDraft(sessionId, (draft) => ({
    ...draft,
    attachments: [...draft.attachments, ...restored],
  }))
  const serverIds = new Map(files.map((file) => [file.id, file.serverId]))
  for (const attachment of restored) {
    const serverId = serverIds.get(attachment.id)
    if (serverId) {
      seedUploadTask(attachment.id, serverId)
    }
  }
  return restored.length
}

export const clearAllDrafts = () => {
  for (const draft of useDrafts.getState().drafts.values()) {
    draft.attachments.forEach((attachment) => cancelUpload(attachment.id))
  }
  useDrafts.setState({ drafts: new Map() })
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key)
      }
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // 存储不可用时只清理内存
  }
}
