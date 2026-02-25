const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slfetch', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getDefaultFolder: () => ipcRenderer.invoke('get-default-folder'),
  startDownload: (payload) => ipcRenderer.invoke('start-download', payload),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  revealInFolder: (filePath) => ipcRenderer.invoke('reveal-in-folder', filePath),
  onDownloadEvent: (callback) => {
    const handler = (_evt, data) => callback(data);
    ipcRenderer.on('download-event', handler);
    return () => ipcRenderer.removeListener('download-event', handler);
  },
});

