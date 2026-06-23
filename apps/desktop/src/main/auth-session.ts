import { safeStorage, type Session } from "electron";
import type { AuthTokenPayload, SetupTokenResponse } from "../shared/types";

type StaffRole = AuthTokenPayload["role"];

type StoredToken = {
  token: string;
  expiresAt: string;
  role: StaffRole | null;
};

function decodeJwtPayload(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      userId?: number;
      role?: string;
      departmentId?: number | null;
    };
    if (typeof parsed.userId !== "number" || typeof parsed.role !== "string") {
      return null;
    }
    return {
      userId: parsed.userId,
      role: parsed.role,
      departmentId: parsed.departmentId ?? null
    };
  } catch {
    return null;
  }
}

function readStoredToken(): StoredToken | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = globalThis.__asbatechsStoredToken;
    if (!encrypted) return null;
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json) as StoredToken;
  } catch {
    return null;
  }
}

function writeStoredToken(value: StoredToken | null): void {
  if (!safeStorage.isEncryptionAvailable()) {
    globalThis.__asbatechsStoredToken = undefined;
    return;
  }
  if (!value) {
    globalThis.__asbatechsStoredToken = undefined;
    return;
  }
  globalThis.__asbatechsStoredToken = safeStorage.encryptString(JSON.stringify(value));
}

declare global {
  // eslint-disable-next-line no-var
  var __asbatechsStoredToken: Buffer | undefined;
}

export class AuthSession {
  private baseUrl: string;
  private sessionRef: Session;
  private bearerToken: string | null = null;
  private bearerExpiresAt: number | null = null;
  private staffRole: StaffRole | null = null;

  constructor(baseUrl: string, sessionRef: Session) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.sessionRef = sessionRef;
    const stored = readStoredToken();
    if (stored && new Date(stored.expiresAt).getTime() > Date.now()) {
      this.bearerToken = stored.token;
      this.bearerExpiresAt = new Date(stored.expiresAt).getTime();
      this.staffRole = stored.role;
    }
  }

  getRole(): StaffRole | null {
    return this.staffRole;
  }

  isEmployee(): boolean {
    return (this.staffRole ?? "").toLowerCase() === "employee";
  }

  async refreshFromSessionCookie(): Promise<boolean> {
    const cookies = await this.sessionRef.cookies.get({
      url: this.baseUrl,
      name: "crm_token"
    });
    const crmToken = cookies[0]?.value;
    if (!crmToken) {
      this.clear();
      return false;
    }

    const meRes = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: { Cookie: `crm_token=${crmToken}` }
    });
    if (!meRes.ok) {
      this.clear();
      return false;
    }

    const meBody = (await meRes.json()) as {
      user?: { role?: string } | null;
    };
    this.staffRole = meBody.user?.role ?? null;

    const setupRes = await fetch(
      `${this.baseUrl}/api/attendance/desktop-agent/setup-token`,
      {
        method: "POST",
        headers: { Cookie: `crm_token=${crmToken}` }
      }
    );
    if (!setupRes.ok) {
      return false;
    }

    const setup = (await setupRes.json()) as SetupTokenResponse;
    this.bearerToken = setup.token;
    this.bearerExpiresAt = new Date(setup.expiresAt).getTime();
    const payload = decodeJwtPayload(setup.token);
    if (payload?.role) {
      this.staffRole = payload.role;
    }

    writeStoredToken({
      token: setup.token,
      expiresAt: setup.expiresAt,
      role: this.staffRole
    });
    return true;
  }

  async getBearerToken(forceRefresh = false): Promise<string | null> {
    const expiresSoon =
      this.bearerExpiresAt != null &&
      this.bearerExpiresAt - Date.now() < 2 * 60 * 1000;
    if (!this.bearerToken || forceRefresh || expiresSoon) {
      const ok = await this.refreshFromSessionCookie();
      if (!ok) return null;
    }
    return this.bearerToken;
  }

  clear(): void {
    this.bearerToken = null;
    this.bearerExpiresAt = null;
    this.staffRole = null;
    writeStoredToken(null);
  }
}
