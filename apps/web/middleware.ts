import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  verifyAuthTokenEdge,
  verifyClientTokenEdge
} from "@/lib/auth-edge";
import { canViewEmployeeDirectory, isAdminRole, normalizeRole } from "@/lib/rbac";

const DESKTOP_INSTALLER_FALLBACK =
  "https://github.com/Shoaibahmed47/asbatechs-crm/releases/latest/download/AsbaTechs.CRM.Setup.0.1.0.exe";

function desktopInstallerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.trim() ||
    process.env.DESKTOP_INSTALLER_URL?.trim() ||
    DESKTOP_INSTALLER_FALLBACK
  );
}

/** Serve install UI from middleware so a stuck prerendered page cannot hide the button. */
function desktopDownloadHtmlResponse(requestId: string): NextResponse {
  const href = desktopInstallerUrl();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Desktop app download · AsbaTechs CRM</title>
  <style>
    body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px}
    main{max-width:40rem}
    .label{font-size:.8rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#38bdf8}
    h1{margin:.5rem 0 0;font-size:1.875rem}
    p,li{line-height:1.6;color:#cbd5e1}
    a.btn{display:inline-block;margin-top:1rem;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:.85rem 1.25rem;border-radius:.75rem}
    a.btn:hover{background:#0369a1}
    a.muted{color:#38bdf8}
    .marker{font-size:.75rem;color:#64748b;margin-top:1rem}
  </style>
</head>
<body>
  <main data-deploy-marker="desktop-mw-v1">
    <p class="label">AsbaTechs CRM</p>
    <h1>Desktop app download</h1>
    <p>Install the AsbaTechs CRM desktop application once per Windows laptop. It includes built-in attendance monitoring — no separate agent or PowerShell setup required.</p>
    <ol>
      <li>Download and run the installer below.</li>
      <li>Sign in with your CRM email and password.</li>
      <li>Keep the app running in the system tray during shifts.</li>
    </ol>
    <p><a class="btn" data-testid="desktop-download-btn" href="${href}">Download AsbaTechs CRM for Windows</a></p>
    <p class="marker">If download fails, open <a class="muted" href="https://github.com/Shoaibahmed47/asbatechs-crm/releases/latest">GitHub Releases</a>.</p>
    <p><a class="muted" href="/login">Back to staff login</a></p>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "x-request-id": requestId,
      "x-desktop-download": "middleware-v1"
    }
  });
}

export async function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const nextWithRequestId = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-request-id", requestId);
    return res;
  };

  const { pathname } = req.nextUrl;

  // Bypass stuck static HTML for the employee install page
  if (pathname === "/download/desktop" || pathname === "/download/desktop/") {
    return desktopDownloadHtmlResponse(requestId);
  }

  const isAuthRoute = pathname === "/login";
  const isForgotPasswordRoute = pathname === "/forgot-password";
  const isClientLogin = pathname === "/client/login";
  const isClientSignup = pathname.startsWith("/client/signup/");
  const isClientPublic = isClientLogin || isClientSignup;

  const isPublicSignup =
    pathname === "/employee-signup" ||
    pathname.startsWith("/employee-signup/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");
  const isRoot = pathname === "/";

  const staffToken = req.cookies.get(COOKIE_NAME)?.value;
  const staffPayload = staffToken ? await verifyAuthTokenEdge(staffToken) : null;

  const clientToken = req.cookies.get(CLIENT_COOKIE_NAME)?.value;
  const clientPayload = clientToken ? await verifyClientTokenEdge(clientToken) : null;

  const isClientAppRoute = pathname.startsWith("/client") && !isClientPublic;

  // Unauthenticated
  if (!staffPayload && !clientPayload) {
    if (pathname.startsWith("/client") && !isClientPublic) {
      const clientLoginUrl = new URL("/client/login", req.url);
      const res = NextResponse.redirect(clientLoginUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    if (
      isRoot ||
      (!isAuthRoute &&
        !isForgotPasswordRoute &&
        !isClientPublic &&
        !isPublicSignup &&
        !pathname.startsWith("/download/desktop") &&
        !pathname.startsWith("/desktop-agent") &&
        !pathname.startsWith("/_next") &&
        !pathname.startsWith("/api") &&
        pathname !== "/favicon.ico")
    ) {
      const loginUrl = new URL("/login", req.url);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    return nextWithRequestId();
  }

  // Client session hitting staff-only app routes → send to client hub
  if (clientPayload && !staffPayload) {
    if (isRoot || isAuthRoute || isForgotPasswordRoute) {
      const url = new URL("/client", req.url);
      const res = NextResponse.redirect(url);
      res.headers.set("x-request-id", requestId);
      return res;
    }
    if (!isClientAppRoute && !isClientPublic && !pathname.startsWith("/api")) {
      const url = new URL("/client", req.url);
      const res = NextResponse.redirect(url);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }

  // Staff session
  if (staffPayload) {
    const staffRole = normalizeRole(staffPayload.role);
    if (
      pathname.startsWith("/admin") &&
      staffRole !== "admin" &&
      staffRole !== "manager"
    ) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const res = NextResponse.redirect(dashboardUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    if (
      pathname.startsWith("/users") &&
      !canViewEmployeeDirectory(staffRole)
    ) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const res = NextResponse.redirect(dashboardUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    if (
      (pathname.startsWith("/settings/departments") ||
        pathname.startsWith("/settings/clients")) &&
      !isAdminRole(staffRole)
    ) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const res = NextResponse.redirect(dashboardUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    // Staff may also hold a client portal cookie after "View as client" (admin impersonation).
    // Only block /client when there is no valid client session.
    if (isClientAppRoute && !clientPayload) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const res = NextResponse.redirect(dashboardUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }

    if (isAuthRoute || isForgotPasswordRoute || isRoot) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const res = NextResponse.redirect(dashboardUrl);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }

  // Client session: protect portal routes
  if (clientPayload && isClientAppRoute) {
    return nextWithRequestId();
  }

  if (clientPayload && isClientPublic) {
    const url = new URL("/client", req.url);
    const res = NextResponse.redirect(url);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  return nextWithRequestId();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
