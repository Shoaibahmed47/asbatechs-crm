import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function candidateExePaths(): string[] {
  const explicit = process.env.ATTENDANCE_AGENT_EXE_PATH?.trim();
  const defaults = [
    path.join(
      process.cwd(),
      "..",
      "desktop-agent",
      "src",
      "windows",
      "bin",
      "Release",
      "net8.0-windows",
      "win-x64",
      "publish",
      "AttendanceAgent.exe"
    ),
    path.join(
      process.cwd(),
      "apps",
      "desktop-agent",
      "src",
      "windows",
      "bin",
      "Release",
      "net8.0-windows",
      "win-x64",
      "publish",
      "AttendanceAgent.exe"
    )
  ];
  return explicit ? [explicit, ...defaults] : defaults;
}

export async function GET() {
  for (const exePath of candidateExePaths()) {
    try {
      const stat = await fs.stat(exePath);
      if (!stat.isFile()) continue;
      const bytes = await fs.readFile(exePath);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="AttendanceAgent.exe"',
          "Cache-Control": "no-store"
        }
      });
    } catch {
      // Try next candidate path.
    }
  }

  return NextResponse.json(
    {
      error:
        "AttendanceAgent.exe not found on server. Set ATTENDANCE_AGENT_EXE_PATH or publish agent first."
    },
    { status: 404 }
  );
}

