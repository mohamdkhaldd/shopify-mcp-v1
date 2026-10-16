const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  // إشعارات من البرنامج للشاشة (زي "وصلت تعديلات من التابلت").
  on: (channel, callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
