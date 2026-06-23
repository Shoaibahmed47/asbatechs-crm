import { app, BrowserWindow, Menu, shell } from "electron";
import path from "path";
import {
  APP_TITLE,
  isAllowedNavigationUrl,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveCrmAppUrl
} from "../shared/config";

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  const crmUrl = resolveCrmAppUrl();
  const crmOrigin = new URL(crmUrl).origin;

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: APP_TITLE,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigationUrl(url, crmOrigin)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, crmOrigin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void win.loadURL(crmUrl);

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => win.webContents.reload()
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open CRM in browser",
          click: () => void shell.openExternal(crmUrl)
        }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return win;
}

export function focusMainWindow(): void {
  const win = getMainWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
