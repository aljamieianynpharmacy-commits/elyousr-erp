const { contextBridge, ipcRenderer } = require('electron');

// Expose print API to print window
contextBridge.exposeInMainWorld('electronAPI', {
    triggerPrint: () => ipcRenderer.invoke('trigger-print')
});
