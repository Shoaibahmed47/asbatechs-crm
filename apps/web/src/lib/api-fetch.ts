"use client";

import { toast } from "sonner";

type JsonRecord = Record<string, unknown>;

export class ApiFetchError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
    this.details = details;
  }
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonRecord | null;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const FORM_DATA_TIMEOUT_MS = 600000;
const LOGIN_REDIRECT_FLAG = "crm_auth_redirected";

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("crm_token") ??
    window.localStorage.getItem("auth_token") ??
    window.localStorage.getItem("token")
  );
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("crm_token");
  window.localStorage.removeItem("auth_token");
  window.localStorage.removeItem("token");
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(LOGIN_REDIRECT_FLAG) === "1") return;
  window.sessionStorage.setItem(LOGIN_REDIRECT_FLAG, "1");
  clearStoredAuth();
  toast.error("Session expired, please login again");
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

async function parseResponseBody(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json().catch(() => null);
  }
  return res.text().catch(() => null);
}

export async function apiFetch<T = unknown>(
  input: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs, headers, body, credentials, ...rest } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const effectiveTimeoutMs = timeoutMs ?? (isFormData ? FORM_DATA_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), effectiveTimeoutMs);

  const requestHeaders = new Headers(headers ?? {});
  const token = getStoredToken();
  if (token && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let requestBody: BodyInit | undefined;
  if (body == null) {
    requestBody = undefined;
  } else if (typeof body === "string" || body instanceof Blob || body instanceof URLSearchParams || isFormData) {
    requestBody = body as BodyInit;
  } else {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  try {
    const res = await fetch(input, {
      ...rest,
      credentials: credentials ?? "same-origin",
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal
    });

    const payload = await parseResponseBody(res);
    if (!res.ok) {
      const isCredentialFailure401 =
        res.status === 401 &&
        typeof input === "string" &&
        (input.includes("/api/auth/login") ||
          input.includes("/api/auth/register") ||
          input.includes("/api/auth/employee-signup") ||
          input.includes("/api/auth/client-login") ||
          input.includes("/api/auth/client-signup"));
      if (res.status === 401 && !isCredentialFailure401) {
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/client")) {
          window.sessionStorage.removeItem(LOGIN_REDIRECT_FLAG);
          window.location.replace("/client/login");
        } else {
          redirectToLogin();
        }
      }
      const message =
        typeof payload === "object" &&
        payload &&
        "error" in (payload as JsonRecord) &&
        typeof (payload as JsonRecord).error === "string"
          ? ((payload as JsonRecord).error as string)
          : `Request failed with status ${res.status}`;
      throw new ApiFetchError(message, res.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiFetchError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiFetchError("Request timeout. Please try again.", 408);
    }
    throw new ApiFetchError("Network error. Please try again.", 0);
  } finally {
    window.clearTimeout(timer);
  }
}

apiFetch.get = function get<T = unknown>(input: string, options?: ApiFetchOptions) {
  return apiFetch<T>(input, { ...(options ?? {}), method: "GET" });
};

apiFetch.post = function post<T = unknown>(
  input: string,
  body?: ApiFetchOptions["body"],
  options?: ApiFetchOptions
) {
  return apiFetch<T>(input, { ...(options ?? {}), method: "POST", body });
};

apiFetch.put = function put<T = unknown>(
  input: string,
  body?: ApiFetchOptions["body"],
  options?: ApiFetchOptions
) {
  return apiFetch<T>(input, { ...(options ?? {}), method: "PUT", body });
};

apiFetch.patch = function patch<T = unknown>(
  input: string,
  body?: ApiFetchOptions["body"],
  options?: ApiFetchOptions
) {
  return apiFetch<T>(input, { ...(options ?? {}), method: "PATCH", body });
};

apiFetch.del = function del<T = unknown>(input: string, options?: ApiFetchOptions) {
  return apiFetch<T>(input, { ...(options ?? {}), method: "DELETE" });
};
