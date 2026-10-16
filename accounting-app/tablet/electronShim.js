// بديل بسيط لـ Electron على التابلت: ipc.js بيسجل كل شاشة بـ ipcMain.handle،
// وهنا بنحفظهم في object عادي والشاشة بتناديهم مباشرة من غير Electron.
export const handlers = {};
export const ipcMain = {
  handle(channel, fn) {
    handlers[channel] = fn;
  },
};
export const app = { getPath: () => "", isPackaged: true };
export default { ipcMain, app };
