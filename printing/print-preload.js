const { contextBridge, ipcRenderer } = require('electron');

// Expose print API to print window
contextBridge.exposeInMainWorld('electronAPI', {
    triggerPrint: (options) => ipcRenderer.invoke('trigger-print', options)
});
