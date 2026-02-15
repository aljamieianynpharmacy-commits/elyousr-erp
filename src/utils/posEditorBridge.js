export const APP_NAVIGATE_EVENT = 'erp:navigate';
export const POS_EDITOR_REQUEST_EVENT = 'erp:pos-editor-request';
export const POS_EDITOR_REQUEST_KEY = 'erp.posEditorRequest';

export const emitPosEditorRequest = (payload) => {
  if (typeof window === 'undefined' || !payload) return;

  const request = {
    ...payload,
    requestedAt: Date.now()
  };

  try {
    localStorage.setItem(POS_EDITOR_REQUEST_KEY, JSON.stringify(request));
  } catch (error) {
    console.error('Failed to persist POS editor request:', error);
  }

  window.dispatchEvent(new CustomEvent(POS_EDITOR_REQUEST_EVENT, { detail: request }));
  window.dispatchEvent(
    new CustomEvent(APP_NAVIGATE_EVENT, {
      detail: { page: 'pos', reason: 'open-editor' }
    })
  );
};

export const readPosEditorRequest = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(POS_EDITOR_REQUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Failed to read POS editor request:', error);
    return null;
  }
};

export const clearPosEditorRequest = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(POS_EDITOR_REQUEST_KEY);
  } catch (error) {
    console.error('Failed to clear POS editor request:', error);
  }
};
