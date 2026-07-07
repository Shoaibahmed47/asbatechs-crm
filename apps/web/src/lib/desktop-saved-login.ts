import { isElectronDesktop } from "@/lib/is-electron-desktop";

export type DesktopSavedLogin = {
  email: string;
  password: string;
};

export async function getDesktopSavedLogin(): Promise<DesktopSavedLogin | null> {
  if (!isElectronDesktop()) return null;
  try {
    const saved = await window.asbatechsDesktop?.getSavedLogin();
    if (!saved?.email || !saved.password) return null;
    return saved;
  } catch {
    return null;
  }
}

export async function saveDesktopLogin(email: string, password: string): Promise<boolean> {
  if (!isElectronDesktop()) return false;
  try {
    return (await window.asbatechsDesktop?.saveLogin(email, password)) ?? false;
  } catch {
    return false;
  }
}

export async function clearDesktopSavedLogin(): Promise<void> {
  if (!isElectronDesktop()) return;
  try {
    await window.asbatechsDesktop?.clearSavedLogin();
  } catch {
    // Non-blocking.
  }
}
