export type AsbatechsDesktopApi = {
  isElectron: true;
  getAppVersion: () => Promise<string>;
  notifySessionReady: () => Promise<boolean>;
  setShiftOpen: (open: boolean) => Promise<void>;
};

declare global {
  interface Window {
    asbatechsDesktop?: AsbatechsDesktopApi;
  }
}

export {};
