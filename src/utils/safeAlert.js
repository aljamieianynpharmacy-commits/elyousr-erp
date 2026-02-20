export const safeAlert = (message, focusEl, options = {}) => {
  const show = async () => {
    if (typeof window !== 'undefined' && window.api?.showMessageBox) {
      await window.api.showMessageBox({
        type: options.type || 'info',
        title: options.title,
        message: String(message ?? ''),
        detail: options.detail,
        buttons: options.buttons
      });
      return;
    }

    if (typeof window !== 'undefined' && window.alert) {
      window.alert(message);
    }
  };

  return Promise.resolve(show()).finally(() => {
    setTimeout(() => {
      try {
        window.focus();
      } catch (err) {
        // ignore focus errors (e.g. if window is not available)
      }
      if (focusEl && typeof focusEl.focus === 'function') {
        focusEl.focus();
      }
    }, 0);
  });
};

export const safeConfirm = async (message, title = 'تأكيد') => {
  if (typeof window !== 'undefined' && window.api?.showMessageBox) {
    const result = await window.api.showMessageBox({
      type: 'question',
      title,
      message: String(message ?? ''),
      buttons: ['موافق', 'إلغاء'],
      defaultId: 0,
      cancelId: 1
    });
    return result?.response === 0;
  }

  if (typeof window !== 'undefined' && window.confirm) {
    return window.confirm(message);
  }

  return false;
};
