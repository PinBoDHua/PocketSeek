import { zh } from './zh.js'

export type TranslationKey = keyof typeof zh
export type TranslationParams = Record<string, string | number>
export type TranslationMessage = { key: TranslationKey; params?: TranslationParams }
/** 带文字链接的提示：link 跟在正文后，在新窗口打开；type 为 error 时前面带错误图标 */
export type LinkedMessage = TranslationMessage & {
  type?: 'error'
  link?: { key: TranslationKey; href: string }
}

export const isTranslationKey = (key: unknown): key is TranslationKey =>
  typeof key === 'string' && Object.hasOwn(zh, key)

const createTranslate =
  (messages: Record<TranslationKey, string>) =>
  (key: TranslationKey, params?: TranslationParams): string =>
    messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = params?.[name]
      return typeof value === 'string' || typeof value === 'number' ? String(value) : placeholder
    })

/** PocketSeek 为中文单语客户端，翻译表只有简体中文。 */
const translateChinese = createTranslate(zh)

/** 组件订阅语言变化（当前固定中文，保留 hook 形态以便后续扩展）。 */
export const useTranslate = () => translateChinese

export const translate = (key: TranslationKey, params?: TranslationParams): string =>
  translateChinese(key, params)
