/**
 * Safe Print Utility
 * Sends HTML to Electron main process for printing
 * Avoids window.open and window.print focus issues
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

    // Fallback: Create hidden iframe for printing
    return await fallbackPrint(html);
  } catch (err) {
    console.error('Print error:', err);
    return { error: err.message };
  }
};

/**
 * Fallback print method using hidden iframe
 * Used when Electron IPC is not available
 */
const fallbackPrint = (html) => {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    iframe.contentWindow.onafterprint = () => {
      document.body.removeChild(iframe);
      resolve({ success: true });
    };
    
    // Trigger print after content loads
    iframe.contentWindow.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        document.body.removeChild(iframe);
        resolve({ error: err.message });
      }
    };
  });
};
