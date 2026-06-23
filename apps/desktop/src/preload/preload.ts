import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("asbatechsDesktop", {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  notifySessionReady: () =>
    ipcRenderer.invoke("desktop:session-ready") as Promise<boolean>,
  setShiftOpen: (open: boolean) =>
    ipcRenderer.invoke("desktop:set-shift-open", open) as Promise<void>
});
