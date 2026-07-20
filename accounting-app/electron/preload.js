const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
});
