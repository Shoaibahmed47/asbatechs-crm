import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthTokenEdge } from "@/lib/auth-edge";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname === "/login";
  const isPublicSignup =
    pathname.startsWith("/employee-signup/") ||
    pathname.startsWith("/reset-password/");
  const isRoot = pathname === "/";

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthTokenEdge(token) : null;

  // If not authenticated
  if (!payload) {
    // Unauthed visiting root or any protected app page → go to login
    if (
      isRoot ||
      (!isAuthRoute &&
        !isPublicSignup &&
        !pathname.startsWith("/_next") &&
        !pathname.startsWith("/api") &&
        pathname !== "/favicon.ico")
    ) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Allow access to auth routes and public assets
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/admin") &&
    payload &&
    payload.role !== "admin" &&
    payload.role !== "manager"
  ) {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Authenticated user
  if (isAuthRoute || isRoot) {
    // Already logged in → send to dashboard
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run middleware for all pages except Next.js assets
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};


