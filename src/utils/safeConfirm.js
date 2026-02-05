/**
 * Safe confirm dialog that uses Electron IPC instead of window.confirm
 * Prevents focus issues in Electron apps
 */
export const safeConfirm = async (message, options = {}) => {
  if (typeof window !== 'undefined' && window.api?.showMessageBox) {
    const result = await window.api.showMessageBox({
      type: 'question',
      title: options.title || 'تأكيد',
      message: String(message ?? ''),
      detail: options.detail,
      buttons: options.buttons || ['نعم', 'لا'],
      defaultId: 0,
      cancelId: 1
    });
    
    return result.response === 0;
  }

  // Fallback to window.confirm
  if (typeof window !== 'undefined' && window.confirm) {
    return window.confirm(message);
  }

  return false;
};
