export type DesktopSavedLogin = {
  email: string;
  password: string;
};

export type AsbatechsDesktopApi = {
  isElectron: true;
  getAppVersion: () => Promise<string>;
  notifySessionReady: () => Promise<boolean>;
  setShiftOpen: (open: boolean) => Promise<void>;
  getSavedLogin: () => Promise<DesktopSavedLogin | null>;
  saveLogin: (email: string, password: string) => Promise<boolean>;
  clearSavedLogin: () => Promise<void>;
};

declare global {
  interface Window {
    asbatechsDesktop?: AsbatechsDesktopApi;
  }
}

export {};
