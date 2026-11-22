import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativeShell } from '../native.js'
import { useSettings } from './settings.js'

/** 触感反馈只在原生壳且设置开启时生效；浏览器静默跳过 */
const enabled = () => isNativeShell() && useSettings.getState().haptics

/** 轻震：发送成功等正向反馈 */
export const hapticLight = () => {
  if (enabled()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  }
}

/** 选择震：切换模型、思考档位等选项变更 */
export const hapticSelection = () => {
  if (enabled()) {
    void Haptics.selectionChanged().catch(() => {})
  }
}

/** 警告震：停止生成等中断操作 */
export const hapticWarning = () => {
  if (enabled()) {
    void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
  }
}