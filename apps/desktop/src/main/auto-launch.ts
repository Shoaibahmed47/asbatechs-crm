import { app } from "electron";

export function configureAutoLaunch(): void {
  if (!app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    args: process.platform === "win32" ? ["--opened-at-login"] : []
  });
}
