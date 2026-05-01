const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  request: (method, path, body) => ipcRenderer.invoke('api:request', { method, path, body }),
  syncOrdersFull: () => ipcRenderer.invoke('orders:sync'),
  onOrdersSyncProgress: (callback) => {
    const channel = 'orders-sync-progress';
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onOrdersBackgroundRefresh: (callback) => {
    const channel = 'orders-background-refresh';
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onUberProfileUpdated: (callback) => {
    const channel = 'uber-profile-updated';
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
