const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  request: (method, path, body) => ipcRenderer.invoke('api:request', { method, path, body })
});
