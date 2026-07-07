import { app, ipcMain, session } from "electron";
import { AttendanceMonitor } from "./attendance-monitor";
import { AuthSession } from "./auth-session";
import { configureAutoLaunch } from "./auto-launch";
import { setupAutoUpdater } from "./updater";
import {
  destroyTray,
  handleWindowClose,
  isShiftOpen,
  setShiftOpen,
  setupTray,
  updateTrayAttendanceStatus
} from "./tray";
import { createMainWindow, focusMainWindow, getMainWindow } from "./window";
import { getCrmAppUrl } from "./crm-app-url";
import {
  clearSavedCredentials,
  getSavedCredentials,
  saveCredentials
} from "./saved-credentials";
let authSession: AuthSession;
let attendanceMonitor: AttendanceMonitor;

let monitorStarted = false;
let trayStatusTimer: NodeJS.Timeout | null = null;

async function refreshTrayStatusFromApi(): Promise<void> {
  if (!authSession.isEmployee()) {
    updateTrayAttendanceStatus("Attendance: admin session (no monitoring)");
    return;
  }

  const token = await authSession.getBearerToken();
  if (!token) {
    updateTrayAttendanceStatus("Attendance: sign in required");
    return;
  }

  try {
    const res = await fetch(`${getCrmAppUrl()}/api/attendance/desktop-agent/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      updateTrayAttendanceStatus("Attendance: status unavailable");
      return;
    }

    const data = (await res.json()) as {
      statusLabel?: string;
      openShift?: boolean;
      state?: string;
    };
    const monitor = data.statusLabel ?? data.state ?? "Unknown";
    const shift = data.openShift ? "Shift open" : "Shift closed";
    updateTrayAttendanceStatus(`Monitor: ${monitor} · ${shift}`);
  } catch {
    updateTrayAttendanceStatus("Attendance: offline");
  }
}

function startTrayStatusPolling(): void {
  if (trayStatusTimer) return;
  void refreshTrayStatusFromApi();
  trayStatusTimer = setInterval(() => {
    void refreshTrayStatusFromApi();
  }, 30_000);
}

async function syncAttendanceMonitor(): Promise<void> {
  const ok = await authSession.refreshFromSessionCookie();
  const shouldRun = ok && authSession.isEmployee();
  if (shouldRun && !monitorStarted) {
    attendanceMonitor.start();
    monitorStarted = true;
    startTrayStatusPolling();
  } else if (!shouldRun && monitorStarted) {
    attendanceMonitor.stop();
    monitorStarted = false;
  }
  await refreshTrayStatusFromApi();
}

function registerIpc(): void {
  ipcMain.handle("desktop:get-app-version", () => app.getVersion());

  ipcMain.handle("desktop:session-ready", async () => {
    const ok = await authSession.refreshFromSessionCookie();
    await syncAttendanceMonitor();
    return ok;
  });

  ipcMain.handle("desktop:set-shift-open", (_event, open: boolean) => {
    setShiftOpen(Boolean(open));
    void refreshTrayStatusFromApi();
  });

  ipcMain.handle("desktop:get-saved-login", () => getSavedCredentials());

  ipcMain.handle("desktop:save-login", (_event, email: unknown, password: unknown) => {
    if (typeof email !== "string" || typeof password !== "string") {
      return false;
    }
    return saveCredentials(email, password);
  });

  ipcMain.handle("desktop:clear-saved-login", () => {
    clearSavedCredentials();
  });
}

app.whenReady().then(() => {
  const crmUrl = getCrmAppUrl();
  authSession = new AuthSession(crmUrl, session.defaultSession);
  attendanceMonitor = new AttendanceMonitor(crmUrl, authSession);

  registerIpc();
  configureAutoLaunch();
  setupAutoUpdater();
  setupTray();

  const win = createMainWindow();
  win.on("close", (event) => {
    if (isShiftOpen()) {
      handleWindowClose(event);
    }
  });

  session.defaultSession.webRequest.onCompleted(
    { urls: [`${crmUrl}/*`] },
    (details) => {
      if (
        details.url.includes("/api/auth/login") &&
        details.statusCode >= 200 &&
        details.statusCode < 300
      ) {
        void syncAttendanceMonitor();
      }
      if (details.url.includes("/api/auth/logout")) {
        authSession.clear();
        attendanceMonitor.stop();
        monitorStarted = false;
        setShiftOpen(false);
      }
    }
  );

  app.on("activate", () => {
    if (getMainWindow() == null) {
      createMainWindow();
    } else {
      focusMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (!isShiftOpen()) {
      app.quit();
    }
  }
});

app.on("before-quit", () => {
  if (trayStatusTimer) {
    clearInterval(trayStatusTimer);
    trayStatusTimer = null;
  }
  attendanceMonitor.stop();
  destroyTray();
});
