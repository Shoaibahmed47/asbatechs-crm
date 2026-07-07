import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";

type StoredLogin = {
  email: string;
  password: string;
};

function credentialsFilePath(): string {
  return path.join(app.getPath("userData"), "saved-login.enc");
}

export function getSavedCredentials(): StoredLogin | null {
  if (!safeStorage.isEncryptionAvailable()) return null;

  const filePath = credentialsFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const encrypted = fs.readFileSync(filePath);
    const json = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(json) as Partial<StoredLogin>;
    if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    if (!parsed.email.trim() || !parsed.password) {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function saveCredentials(email: string, password: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;

  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) return false;

  try {
    const payload: StoredLogin = { email: normalizedEmail, password };
    const encrypted = safeStorage.encryptString(JSON.stringify(payload));
    fs.writeFileSync(credentialsFilePath(), encrypted);
    return true;
  } catch {
    return false;
  }
}

export function clearSavedCredentials(): void {
  try {
    const filePath = credentialsFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best-effort clear.
  }
}
