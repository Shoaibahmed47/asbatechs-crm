import { app, BrowserWindow, Menu, shell } from "electron";
import path from "path";
import {
  APP_TITLE,
  isAllowedNavigationUrl,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH
} from "../shared/config";
import { getCrmAppUrl } from "./crm-app-url";

let mainWindow: BrowserWindow | null = null;

function showLoadErrorPage(win: BrowserWindow, crmUrl: string, detail: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AsbaTechs CRM</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 0; padding: 40px; background: #f8fafc; color: #0f172a; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { line-height: 1.55; margin: 0 0 12px; color: #334155; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
    ul { margin: 12px 0 0 18px; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Could not load CRM</h1>
    <p>The desktop app tried to open:</p>
    <p><code>${crmUrl}</code></p>
    <p>${detail}</p>
    <ul>
      <li>Confirm this URL opens in your browser.</li>
      <li>Check internet connection.</li>
      <li>Ask IT to rebuild the installer with the correct live CRM URL.</li>
    </ul>
  </div>
</body>
</html>`;
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  const crmUrl = getCrmAppUrl();
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

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith("data:")) return;
    const detail = `Error ${errorCode}: ${errorDescription}`;
    showLoadErrorPage(win, crmUrl, detail);
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
