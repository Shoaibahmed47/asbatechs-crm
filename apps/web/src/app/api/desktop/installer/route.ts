import { NextResponse } from "next/server";

import { DESKTOP_INSTALLER_DOWNLOAD_URL } from "@/lib/desktop-installer-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Stable redirect so clients can hit /api/desktop/installer even if HTML page is cached. */
export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.trim() ||
    process.env.DESKTOP_INSTALLER_URL?.trim() ||
    DESKTOP_INSTALLER_DOWNLOAD_URL;

  return NextResponse.redirect(url, 302);
}
