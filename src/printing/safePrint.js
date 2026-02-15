/**
 * Safe Print Utility
 * Sends HTML to Electron main process for print preview
 * In non-Electron environments, opens a preview window (manual print only)
 */

export const safePrint = async (html, options = {}) => {
  try {
    // Check if Electron IPC print handler is available
    if (typeof window !== 'undefined' && window.api?.printHTML) {
      const result = await window.api.printHTML({
        html,
        title: options.title || 'Print',
        silent: options.silent || false
      });
      
      if (result?.error) {
        throw new Error(result.error);
      }
      
      return { success: true };
    }

    // Fallback: open browser preview window without auto-print
    return await fallbackPreview(html, options);
  } catch (err) {
    console.error('Print error:', err);
    return { error: err.message };
  }
};

/**
 * Fallback preview method using browser popup
 * Used when Electron IPC is not available
 */
const fallbackPreview = (html, options = {}) => {
  return new Promise((resolve) => {
    try {
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        resolve({ error: 'Popup blocked. Please allow popups and try again.' });
        return;
      }

      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
      previewWindow.document.title = options.title || 'Print Preview';
      previewWindow.focus();

      resolve({ success: true, previewOpened: true });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
};
