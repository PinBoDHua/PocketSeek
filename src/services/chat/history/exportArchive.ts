import * as db from '../db.js'
import type { Session } from '../types.js'
import { fail } from './errors.js'
import { EXPORT_FORMAT_VERSION, type Manifest, type SessionIndexEntry } from './format.js'
import { INDEX_PATH, MANIFEST_PATH, filePath, sessionPath } from './paths.js'
import { toIndexEntry, toSessionFile } from './toArchive.js'
import { MAX_ARCHIVE_ENTRY_BYTES, MAX_ARCHIVE_TOTAL_BYTES } from './zipReader.js'
import { writeArchive } from './zipWriter.js'

const json = (value: unknown) => new Blob([JSON.stringify(value)], { type: 'application/json' })

/**
 * 按导出格式生成 ZIP：manifest → 全部会话 JSON → index → 全部附件原件。没有账号信息，不写 user.json。
 * 图片与文档只要本地有原件都会写出，保证导入后附件仍可继续使用；无原件时仅保留元数据。
 */
export const exportArchive = async (
  sessions: Iterable<Session> | AsyncIterable<Session>
): Promise<Blob> => {
  const manifest: Manifest = { export_format_version: EXPORT_FORMAT_VERSION }
  const entries = [{ name: MANIFEST_PATH, blob: json(manifest) }]
  const fileEntries: { name: string; blob: Blob }[] = []
  const index: SessionIndexEntry[] = []
  const originals = new Map<string, Blob | undefined>()
  for await (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === 'user') {
        for (const file of message.files) {
          if (!originals.has(file.id)) {
            originals.set(file.id, await db.loadFile(file.id))
          }
        }
      }
    }
    const files = new Map<string, Blob>()
    const data = toSessionFile(session, ({ id, name }) => {
      const blob = originals.get(id)
      if (!blob) {
        return null
      }
      const path = filePath(session.id, id, name)
      files.set(path, blob)
      return path
    })
    entries.push({ name: sessionPath(session.id), blob: json(data) })
    for (const [name, blob] of files) {
      fileEntries.push({ name, blob })
    }
    index.push(toIndexEntry(data))
  }
  entries.push({ name: INDEX_PATH, blob: json(index) })
  const all = entries.concat(fileEntries)
  // 保证本应用导出的归档能被自身导入：超出导入上限时提前给出可操作提示。
  let total = 0
  for (const entry of all) {
    if (entry.blob.size > MAX_ARCHIVE_ENTRY_BYTES) {
      fail('backupTooLarge')
    }
    total += entry.blob.size
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      fail('backupTooLarge')
    }
  }
  return writeArchive(all)
}
