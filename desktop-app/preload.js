const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onBalanzaData: (callback) => {
    // Removemos listeners previos para evitar duplicados en re-renders de React
    ipcRenderer.removeAllListeners('balanza-data');
    ipcRenderer.on('balanza-data', (event, data) => callback(data));
  },
  onBalanzaStatus: (callback) => {
    ipcRenderer.removeAllListeners('balanza-status');
    ipcRenderer.on('balanza-status', (event, status) => callback(status));
  },
  requestBalanzaData: () => ipcRenderer.send('request-balanza-data'),
  forceCaptureBalanza: () => ipcRenderer.send('force-capture-balanza')
});
