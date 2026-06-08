  import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  verifyAuthTokenEdge,
  verifyClientTokenEdge
} from "@/lib/auth-edge";
import { canViewEmployeeDirectory, isAdminRole, normalizeRole } from "@/lib/rbac";

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
