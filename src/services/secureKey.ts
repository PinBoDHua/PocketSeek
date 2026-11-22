import { registerPlugin } from '@capacitor/core'
import { isNativeShell } from '../native.js'

type SecureKeyStorePlugin = {
  get: () => Promise<{ value: string | null }>
  set: (options: { value: string }) => Promise<void>
  remove: () => Promise<void>
}

const secureKeyStore = registerPlugin<SecureKeyStorePlugin>('SecureKeyStore')

/** 旧版本与浏览器版本的存储位置；原生壳首次启动时会迁移到 Keystore。 */
const LEGACY_STORAGE_KEY = 'pocketseek:api-key'

const readLegacy = (): string | null => {
  try {
    return localStorage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return null
  }
}

const writeLegacy = (value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } else {
      localStorage.setItem(LEGACY_STORAGE_KEY, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 新原生壳带 SecureKeyStore 插件；旧壳与浏览器退回 localStorage。 */
export const hasSecureKeyStore = (): boolean => {
  if (!isNativeShell()) {
    return false
  }
  const capacitor = (
    window as unknown as {
      Capacitor?: { isPluginAvailable?: (name: string) => boolean }
    }
  ).Capacitor
  return Boolean(capacitor?.isPluginAvailable?.('SecureKeyStore'))
}

/** 原生壳在异步读取完成前按"无 Key"渲染，避免用明文旧值覆盖安全存储。 */
export const initialApiKey = (): string | null => (hasSecureKeyStore() ? null : readLegacy())

/** 启动时读取；旧 localStorage Key 会迁移进 Keystore 并删除明文副本。 */
export const loadApiKey = async (): Promise<string | null> => {
  if (!hasSecureKeyStore()) {
    return readLegacy()
  }
  try {
    const { value } = await secureKeyStore.get()
    if (value) {
      writeLegacy(null)
      return value
    }
    const legacy = readLegacy()
    if (legacy) {
      await secureKeyStore.set({ value: legacy })
      writeLegacy(null)
      return legacy
    }
    return null
  } catch {
    // 插件暂时不可用时保留旧值，避免用户丢失 Key；下次启动会重试迁移。
    return readLegacy()
  }
}

/** 写入失败必须抛出，让设置页明确提示，不能静默退回明文存储。 */
export const persistApiKey = async (value: string | null): Promise<void> => {
  if (!hasSecureKeyStore()) {
    writeLegacy(value)
    return
  }
  if (value) {
    await secureKeyStore.set({ value })
  } else {
    await secureKeyStore.remove()
  }
  writeLegacy(null)
}
