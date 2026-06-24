import { app } from "electron";
import fs from "fs";
import path from "path";

import { BAKED_CRM_APP_URL } from "../shared/baked-crm-url";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function readUrlFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const line = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find((row) => row && !row.startsWith("#"));
    if (!line) return null;
    return stripTrailingSlash(line);
  } catch {
    return null;
  }
}

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * CRM origin loaded by the desktop shell.
 * Priority: CRM_APP_URL env → userData/crm-app.url → bundled resource → baked build URL → localhost.
 */
export function getCrmAppUrl(): string {
  const fromEnv = process.env.CRM_APP_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);

  if (app.isPackaged) {
    const fromUserData = readUrlFile(path.join(app.getPath("userData"), "crm-app.url"));
    if (fromUserData && !isLocalhost(fromUserData)) return fromUserData;

    const fromResources = readUrlFile(path.join(process.resourcesPath, "crm-app.url"));
    if (fromResources && !isLocalhost(fromResources)) return fromResources;
  }

  if (BAKED_CRM_APP_URL && BAKED_CRM_APP_URL !== "__LOCALHOST__" && !isLocalhost(BAKED_CRM_APP_URL)) {
    return stripTrailingSlash(BAKED_CRM_APP_URL);
  }

  return "http://localhost:3000";
}
