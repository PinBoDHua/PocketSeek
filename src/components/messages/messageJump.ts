import { create } from 'zustand'

type JumpTarget = {
  sessionId: string
  messageId: string
  /** 递增序号：同一会话重复搜索同一消息时也能触发定位 */
  nonce: number
}

/** 全局搜索结果 → 消息列表的一次性跳转目标 */
export const useMessageJump = create<{ target: JumpTarget | null }>(() => ({ target: null }))

let nonce = 0

export const jumpToMessage = (sessionId: string, messageId: string) => {
  nonce += 1
  useMessageJump.setState({ target: { sessionId, messageId, nonce } })
}
