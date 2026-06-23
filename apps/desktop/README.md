# AsbaTechs CRM Desktop

Electron shell for the hosted AsbaTechs CRM web application with built-in employee attendance monitoring (replaces the legacy Windows `.NET` agent).

## Development

1. Start the web CRM:

```bash
npm run dev
```

2. In another terminal:

```bash
npm run dev:desktop
```

Set `CRM_APP_URL` to your hosted CRM when testing against production:

```bash
CRM_APP_URL=https://crm.example.com npm run dev:desktop
```

## Build installer (Windows x64)

**Unsigned** (local dev / test):

```bash
npm run build:desktop
```

**Signed** (production — requires certificate):

```bash
# Set CSC_LINK and CSC_KEY_PASSWORD first (see signing.env.example)
npm run build:desktop:signed
```

Output: `apps/desktop/release/`

Copy `apps/desktop/signing.env.example` → `signing.env` and fill in certificate paths (file is gitignored).

Optional environment variables:

- `CRM_APP_URL` — CRM origin baked into dev defaults (runtime uses the URL loaded at launch; set before `package` if you ship a fixed host).
- `DESKTOP_UPDATE_URL` — generic update feed URL for `electron-updater`.
- `CSC_LINK` / `CSC_KEY_PASSWORD` — Windows Authenticode signing (**required** for employee rollout on Windows 11 Smart App Control).

Verify signature after a signed build:

```bash
npm run verify:signature --workspace apps/desktop
```

## IT deployment

See [docs/desktop-app-deployment.md](../../docs/desktop-app-deployment.md) for silent install (`/S`), code signing, auto-updates, and rollout checklist.

## Employee setup (replaces agent install)

1. Install **AsbaTechs CRM** desktop app once.
2. Sign in with CRM credentials.
3. Keep the app running (tray) during shifts — sleep/lock monitoring runs in the app main process.

No PowerShell scripts or `AttendanceAgent.exe` required for new deployments.

## Legacy agent

The [.NET desktop agent](../desktop-agent/) remains in the repo during migration but is **deprecated**. Use this Electron app for new employee machines.
