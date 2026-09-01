const { contextBridge, ipcRenderer } = require("electron");

const bridge = Object.freeze({
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke("rawaqan:get-settings"),
  getAppInfo: () => ipcRenderer.invoke("rawaqan:get-app-info"),
  getBackupStatus: () => ipcRenderer.invoke("rawaqan:get-backup-status"),
  saveLocalBackup: (snapshot) =>
    ipcRenderer.invoke("rawaqan:save-local-backup", snapshot),
  configurePrinter: () => ipcRenderer.invoke("rawaqan:configure-printer"),
  printReceipt: (job) => ipcRenderer.invoke("rawaqan:print-receipt", job),
  clearSession: () => ipcRenderer.invoke("rawaqan:clear-session"),
});

contextBridge.exposeInMainWorld("rawaqanDesktop", bridge);
