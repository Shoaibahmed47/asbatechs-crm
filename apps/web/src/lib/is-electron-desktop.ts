/** True when running inside the AsbaTechs CRM Electron desktop shell. */
export function isElectronDesktop(): boolean {
  return typeof window !== "undefined" && window.asbatechsDesktop?.isElectron === true;
}

export async function notifyElectronSessionReady(): Promise<boolean> {
  if (!isElectronDesktop()) return false;
  try {
    return (await window.asbatechsDesktop?.notifySessionReady()) ?? false;
  } catch {
    return false;
  }
}

export async function syncElectronShiftOpen(open: boolean): Promise<void> {
  if (!isElectronDesktop()) return;
  try {
    await window.asbatechsDesktop?.setShiftOpen(open);
  } catch {
    // Non-blocking.
  }
}
