import { memo } from 'react'
import styles from './MessageTime.module.css'

/**
 * 当天只显示时分，跨天再补上月日。
 * 时区与字段拼接交给 Intl（zh-CN），不做手工换算。
 */
const timeFormat = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** 消息时间：12px tertiary、等宽数字，避免各条消息的时间宽度跳动。 */
export const MessageTime = memo(function MessageTime({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt)
  return (
    <time className={styles.time} dateTime={date.toISOString()}>
      {isSameDay(date, new Date()) ? timeFormat.format(date) : dateTimeFormat.format(date)}
    </time>
  )
})
