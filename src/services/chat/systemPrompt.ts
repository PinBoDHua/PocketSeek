/**
 * 所有生成请求统一携带的助手身份说明。
 * PocketSeek 是第三方客户端：不冒充 DeepSeek 官方，也不自称「由深度求索创造」。
 * 身份说明始终在最前，用户自定义提示词追加在后，不能覆盖第三方身份声明。
 */
export const IDENTITY_PROMPT =
  '你是运行在 PocketSeek 中的中文 AI 助手。PocketSeek 是第三方 DeepSeek API 客户端，由 DeepSeek 模型驱动，与深度求索公司没有隶属或官方合作关系。当用户询问身份或来源时，请如实说明这一点，不要自称 DeepSeek 官方客户端。'

/** 用户自定义系统提示词上限（字符） */
export const MAX_SYSTEM_PROMPT_LENGTH = 2000

/** 去掉首尾空白并截断到上限，供保存设置时使用 */
export const normalizeSystemPrompt = (value: string): string =>
  value.trim().slice(0, MAX_SYSTEM_PROMPT_LENGTH)

/** 组装请求的 system 字段：身份说明在前，非空自定义追加在后 */
export const buildSystemPrompt = (custom: string): string => {
  const trimmed = custom.trim()
  return trimmed ? `${IDENTITY_PROMPT}\n\n${trimmed}` : IDENTITY_PROMPT
}