import { notifications } from '@mantine/notifications'

// 普通告知 toast(无撤销动作)——用于「到上限」等一次性提示。区别于 showUndoToast(那个带点击撤销)。
type ShowInfoToastOptions = {
  id?: string
}

export function showInfoToast(message: string, options?: ShowInfoToastOptions): void {
  try {
    notifications.show({ id: options?.id, message, color: 'gray', autoClose: 2500, withCloseButton: false })
  } catch {
    /* notifications host 未挂载时静默 */
  }
}
