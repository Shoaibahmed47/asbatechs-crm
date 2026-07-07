import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("asbatechsDesktop", {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  notifySessionReady: () =>
    ipcRenderer.invoke("desktop:session-ready") as Promise<boolean>,
  setShiftOpen: (open: boolean) =>
    ipcRenderer.invoke("desktop:set-shift-open", open) as Promise<void>,
  getSavedLogin: () =>
    ipcRenderer.invoke("desktop:get-saved-login") as Promise<{
      email: string;
      password: string;
    } | null>,
  saveLogin: (email: string, password: string) =>
    ipcRenderer.invoke("desktop:save-login", email, password) as Promise<boolean>,
  clearSavedLogin: () => ipcRenderer.invoke("desktop:clear-saved-login") as Promise<void>
});
