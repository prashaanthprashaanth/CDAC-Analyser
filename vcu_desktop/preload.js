const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("VCUDesktop", {
  saveExport: async ({ filename, bytes }) => ipcRenderer.invoke("vcu:save-export", {
    filename,
    bytes
  })
});
