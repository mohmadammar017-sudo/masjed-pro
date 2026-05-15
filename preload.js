
const { contextBridge, ipcRenderer } = require('electron');

const bindChannel = (channel, callback) => {
  const listener = (event, payload) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

contextBridge.exposeInMainWorld('electron', {
  zoom: {
    set: (factor) => ipcRenderer.invoke('zoom:set', factor),
    get: () => ipcRenderer.invoke('zoom:get'),
    getSmartLevel: () => ipcRenderer.invoke('zoom:smart-detect'),
  },
  remoteControl: {
    getStatus: () => ipcRenderer.invoke('remote-control:get-status'),
    onStatus: (callback) => bindChannel('remote-control:status', callback),
    onCommand: (callback) => bindChannel('remote-control:command', callback),
    publishState: (state) => ipcRenderer.send('remote-control:publish-state', state),
  }
});
