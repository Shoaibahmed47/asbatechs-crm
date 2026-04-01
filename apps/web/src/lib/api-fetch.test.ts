/**
 * @jest-environment jsdom
 */

import { ApiFetchError, apiFetch } from "./api-fetch";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("attaches Authorization header from localStorage", async () => {
    localStorage.setItem("crm_token", "abc123");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true })
    } as any);
    globalThis.fetch = fetchMock as any;

    await apiFetch("/api/test");

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer abc123");
  });

  it("handles 401 globally and redirects to login", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => "application/json" },
      json: async () => ({ error: "Unauthorized" })
    } as any);
    globalThis.fetch = fetchMock as any;

    await expect(apiFetch("/api/protected")).rejects.toBeInstanceOf(ApiFetchError);
    expect(fetchMock).toHaveBeenCalled();
    expect(sessionStorage.getItem("crm_auth_redirected")).toBe("1");
  });
});
