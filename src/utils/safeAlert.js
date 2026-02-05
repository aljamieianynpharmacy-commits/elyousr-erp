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
