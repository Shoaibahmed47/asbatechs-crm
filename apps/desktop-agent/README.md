# Desktop Attendance Agent

This folder contains a Windows desktop agent scaffold for attendance compliance events.

## What it sends

- `activity`
- `idle_warning`
- `idle_start`
- `idle_end`
- `lock`
- `unlock`

These events are posted to the web backend route:

- `POST /api/attendance/activity`

## Why this exists

Browser-only tracking stops when the browser/app tab closes. A desktop agent can continue monitoring lock/unlock and system idle in the background.

## Configure

Set environment variables before running:

- `ATT_AGENT_BASE_URL` example: `http://localhost:3000`
- Auth mode A: `ATT_AGENT_TOKEN` (static bearer token)
- Auth mode B (recommended): `ATT_AGENT_EMAIL` + `ATT_AGENT_PASSWORD` (agent auto-login and token refresh)
- `ATT_AGENT_IDLE_WARNING_MINUTES` default `7`
- `ATT_AGENT_IDLE_START_MINUTES` default `10`
- `ATT_AGENT_ACTIVITY_PING_SECONDS` default `60`
- `ATT_AGENT_POLL_SECONDS` default `10`
- `ATT_AGENT_TOKEN_REFRESH_LEAD_MINUTES` default `15`

## Run (development)

```powershell
dotnet run --project .\src\windows\AttendanceAgent.csproj
```

## Build `.exe` (single file)

```powershell
dotnet publish .\src\windows\AttendanceAgent.csproj -c Release -r win-x64 -p:PublishSingleFile=true --self-contained false
```

Output binary is generated under:

- `.\src\windows\bin\Release\net8.0-windows\win-x64\publish\AttendanceAgent.exe`

## Install as background startup task (recommended)

Run once (PowerShell as Administrator):

```powershell
.\apps\desktop-agent\scripts\install-agent-task.ps1 `
  -AgentExePath "C:\Users\User\asbatechs_crm\apps\desktop-agent\src\windows\bin\Release\net8.0-windows\win-x64\publish\AttendanceAgent.exe" `
  -BaseUrl "http://localhost:3000" `
  -Email "employee@company.com" `
  -Password "employee_login_password"
```

Static token mode (optional):

```powershell
.\apps\desktop-agent\scripts\install-agent-task.ps1 `
  -AgentExePath "C:\Users\User\asbatechs_crm\apps\desktop-agent\src\windows\bin\Release\net8.0-windows\win-x64\publish\AttendanceAgent.exe" `
  -BaseUrl "http://localhost:3000" `
  -Token "<employee-bearer-token>"
```

Verify:

```powershell
.\apps\desktop-agent\scripts\verify-agent.ps1
```

Uninstall task:

```powershell
.\apps\desktop-agent\scripts\uninstall-agent-task.ps1
```

## Why not Windows Service for this logic?

This agent needs interactive user-session signals (keyboard/mouse idle + lock/unlock behavior tied to user session). A per-user startup task is more reliable for that than Session 0 service hosting.

## Notes

- This is a scaffold start, not yet packaged as MSI installer.
- For production rollout, we should add:
  - secure token provisioning/rotation
  - signed installer
  - central device health monitoring
