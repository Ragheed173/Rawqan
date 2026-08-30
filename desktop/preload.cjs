const { contextBridge, ipcRenderer } = require("electron");

const bridge = Object.freeze({
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke("rawaqan:get-settings"),
  configurePrinter: () => ipcRenderer.invoke("rawaqan:configure-printer"),
  printReceipt: (job) => ipcRenderer.invoke("rawaqan:print-receipt", job),
});

contextBridge.exposeInMainWorld("rawaqanDesktop", bridge);
