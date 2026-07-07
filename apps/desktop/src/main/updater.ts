import { app } from "electron";
import { autoUpdater } from "electron-updater";

export function setupAutoUpdater(): void {
  if (!app.isPackaged) return;
  if (!process.env.DESKTOP_UPDATE_URL?.trim()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.warn("[desktop-updater]", error.message);
  });

  app.whenReady().then(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  });
}
