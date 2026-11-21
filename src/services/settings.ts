import { create } from 'zustand'
import type { ChatModel, ThinkEffort } from './api/types.js'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'

/** 应用界面固定为简体中文（PocketSeek 为中文单语客户端） */
export type Locale = 'zh-CN'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 阅读体验：正文字号 / 行距 / 消息宽度 */
export type ReadFontSize = 'small' | 'standard' | 'large'
export type ReadLineHeight = 'compact' | 'standard' | 'relaxed'
export type MessageWidth = 'compact' | 'standard' | 'wide'

/**
 * 本机设置，全部保存在 localStorage：API Key、主题、位置、朗读音色、
 * 默认模型、思考档位、智能搜索、用量脚注、侧边栏收起状态。
 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  /** 新会话使用的模型；Pro 不支持图片输入 */
  model: ChatModel
  /** 思考档位：none 关闭，其余对应官方 reasoning effort */
  effort: ThinkEffort
  search: boolean
  /** 回复下方的用量与估算费用脚注 */
  showUsage: boolean
  /** 阅读体验 */
  readFontSize: ReadFontSize
  readLineHeight: ReadLineHeight
  messageWidth: MessageWidth
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'pocketseek:api-key',
  location: 'pocketseek:location',
  themePreference: 'pocketseek:theme-preference',
  ttsVoice: 'pocketseek:tts-voice',
  model: 'pocketseek:model',
  effort: 'pocketseek:effort',
  search: 'pocketseek:search',
  showUsage: 'pocketseek:show-usage',
  readFontSize: 'pocketseek:read-font-size',
  readLineHeight: 'pocketseek:read-line-height',
  messageWidth: 'pocketseek:message-width',
  siderCollapsed: 'pocketseek:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 未保存过时默认 Flash：便宜、快，且支持图片输入 */
const initialModel = (): ChatModel =>
  read(KEYS.model) === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash'

/** 未保存过时默认高档思考（官方默认 effort 即 high） */
const initialEffort = (): ThinkEffort => {
  const saved = read(KEYS.effort)
  return saved === 'none' || saved === 'low' || saved === 'high' || saved === 'max' ? saved : 'high'
}

/** 三选一设置：值不在候选内时回退默认，避免旧数据或手改 localStorage 破坏界面 */
const initialChoice = <T extends string>(key: string, options: readonly T[], fallback: T): T => {
  const saved = read(key)
  return options.includes(saved as T) ? (saved as T) : fallback
}

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  locale: 'zh-CN',
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  model: initialModel(),
  effort: initialEffort(),
  search: read(KEYS.search) === 'true',
  showUsage: read(KEYS.showUsage) !== 'false',
  readFontSize: initialChoice(KEYS.readFontSize, ['small', 'standard', 'large'], 'standard'),
  readLineHeight: initialChoice(
    KEYS.readLineHeight,
    ['compact', 'standard', 'relaxed'],
    'standard'
  ),
  messageWidth: initialChoice(KEYS.messageWidth, ['compact', 'standard', 'wide'], 'standard'),
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setModel = (model: ChatModel) => {
  write(KEYS.model, model)
  useSettings.setState({ model })
}

export const setEffort = (effort: ThinkEffort) => {
  write(KEYS.effort, effort)
  useSettings.setState({ effort })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setShowUsage = (showUsage: boolean) => {
  write(KEYS.showUsage, String(showUsage))
  useSettings.setState({ showUsage })
}

export const setReadFontSize = (readFontSize: ReadFontSize) => {
  write(KEYS.readFontSize, readFontSize)
  useSettings.setState({ readFontSize })
}

export const setReadLineHeight = (readLineHeight: ReadLineHeight) => {
  write(KEYS.readLineHeight, readLineHeight)
  useSettings.setState({ readLineHeight })
}

export const setMessageWidth = (messageWidth: MessageWidth) => {
  write(KEYS.messageWidth, messageWidth)
  useSettings.setState({ messageWidth })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
