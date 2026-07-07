import { app, Menu, nativeImage, Tray } from "electron";
import path from "path";
import { APP_TITLE } from "../shared/config";
import { focusMainWindow, getMainWindow } from "./window";

let tray: Tray | null = null;
let shiftOpen = false;
let attendanceStatusText = "Attendance: not signed in";

export function setShiftOpen(open: boolean): void {
  shiftOpen = open;
  if (open) {
    updateTrayAttendanceStatus("Attendance: on shift");
  } else if (attendanceStatusText.startsWith("Attendance: on shift")) {
    updateTrayAttendanceStatus("Attendance: not clocked in");
  }
}

export function isShiftOpen(): boolean {
  return shiftOpen;
}

export function updateTrayAttendanceStatus(status: string): void {
  attendanceStatusText = status;
  rebuildTrayMenu();
}

function resolveTrayIcon() {
  const packagedIcon = path.join(process.resourcesPath, "brand-icon.png");
  const devIcon = path.join(__dirname, "../../../web/public/brand-icon.png");
  const iconPath = app.isPackaged ? packagedIcon : devIcon;
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return nativeImage.createEmpty();
  }
}

function rebuildTrayMenu(): void {
  if (!tray) return;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open AsbaTechs CRM",
        click: () => focusMainWindow()
      },
      { type: "separator" },
      {
        label: attendanceStatusText,
        enabled: false
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit()
      }
    ])
  );
}

export function setupTray(): void {
  if (tray) return;

  const icon = resolveTrayIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip(APP_TITLE);
  rebuildTrayMenu();
  tray.on("double-click", () => focusMainWindow());
}

export function handleWindowClose(event: Electron.Event): void {
  const win = getMainWindow();
  if (!win) return;

  if (shiftOpen) {
    event.preventDefault();
    win.hide();
    return;
  }

  if (process.platform === "darwin") {
    event.preventDefault();
    win.hide();
  }
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
