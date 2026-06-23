# AsbaTechs CRM Desktop App — IT Deployment Guide

This guide covers rolling out the Electron desktop app (`apps/desktop`) to employee Windows laptops. It replaces the legacy `.NET` attendance agent and PowerShell install scripts.

## What employees need

1. Windows 10/11 x64
2. One-time install of **AsbaTechs CRM** desktop app
3. CRM staff login (same email/password as the web CRM)
4. Keep the app running in the system tray during shifts

No PowerShell, no `AttendanceAgent.exe`, no `ATT_AGENT_*` environment variables.

## Build the installer (IT / release engineer)

From the monorepo root:

```bash
npm install
npm run build:desktop
```

Output directory:

```text
apps/desktop/release/
```

Typical artifacts:

- `AsbaTechs CRM Setup x.x.x.exe` — NSIS installer (interactive)
- `latest.yml` — update manifest (when `DESKTOP_UPDATE_URL` is configured)

### Environment variables (build / release)

| Variable | Purpose |
|----------|---------|
| `CRM_APP_URL` | CRM origin the app loads (e.g. `https://crm.asbatechs.com`). Set before packaging if you bake a fixed host in dev scripts. |
| `DESKTOP_UPDATE_URL` | HTTPS folder for `electron-updater` (must host `latest.yml` + installers) |
| `CSC_LINK` | Path to `.pfx` code-signing certificate |
| `CSC_KEY_PASSWORD` | Certificate password |

See [Windows code signing](#windows-code-signing-production) below — **required** for employee laptops with Smart App Control enabled.

### Web CRM env (after installer is hosted)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_DESKTOP_INSTALLER_URL` | Direct HTTPS link to the `.exe` shown on `/download/desktop` |

Example:

```env
NEXT_PUBLIC_DESKTOP_INSTALLER_URL=https://downloads.asbatechs.com/crm/AsbaTechs-CRM-Setup-0.1.0.exe
```

## Windows code signing (production)

Unsigned builds are fine for **local dev** only. Employee machines running **Windows 11 Smart App Control** will block `AsbaTechs CRM.exe` with *“we could not verify its publisher”* until the installer and app are signed with a trusted Authenticode certificate.

### 1. Obtain a certificate

| Item | Guidance |
|------|----------|
| Type | **Standard** or **EV** Code Signing (Authenticode) |
| Providers | DigiCert, Sectigo, SSL.com, etc. |
| Cost | Roughly USD 200–400 / year |
| Deliverable | `.pfx` file + private-key password |
| Verification | Company legal name / D-U-N-S (few business days) |

Store the `.pfx` on a **secure build machine** or in **CI secrets** — never commit to git, never email to employees.

Template for local env (copy `apps/desktop/signing.env.example` → `apps/desktop/signing.env`, already gitignored):

```env
CSC_LINK=C:\certs\asbatechs-code-signing.pfx
CSC_KEY_PASSWORD=your-certificate-password
```

### 2. Build a signed installer

**Unsigned** (dev / internal test only):

```bash
npm run build:desktop
```

**Signed** (production rollout):

**CMD (Windows):**

```cmd
set CSC_LINK=C:\certs\asbatechs-code-signing.pfx
set CSC_KEY_PASSWORD=your-certificate-password
npm run build:desktop:signed
```

**PowerShell:**

```powershell
$env:CSC_LINK = "C:\certs\asbatechs-code-signing.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"
npm run build:desktop:signed
```

**Git Bash / macOS CI** (path to pfx on the build agent):

```bash
export CSC_LINK=/path/to/asbatechs-code-signing.pfx
export CSC_KEY_PASSWORD='your-certificate-password'
npm run build:desktop:signed
```

Output (same folder as unsigned):

```text
apps/desktop/release/AsbaTechs CRM Setup x.x.x.exe
```

`electron-builder` signs the NSIS installer, uninstaller, and `AsbaTechs CRM.exe` when `CSC_LINK` + `CSC_KEY_PASSWORD` are set and `build:desktop:signed` is used.

### 3. Verify the signature (before distributing)

**PowerShell:**

```powershell
Get-AuthenticodeSignature "apps\desktop\release\AsbaTechs CRM Setup 0.1.0.exe" | Format-List
```

Expected: `Status : Valid` and **Publisher** shows your company name (e.g. AsbaTechs).

From `apps/desktop`:

```bash
npm run verify:signature
```

Also check the installed app:

```powershell
Get-AuthenticodeSignature "C:\Program Files\AsbaTechs CRM\AsbaTechs CRM.exe" | Format-List
```

### 4. Distribute the signed build

1. Upload the **signed** `.exe` to your HTTPS download host.
2. Set `NEXT_PUBLIC_DESKTOP_INSTALLER_URL` on the web CRM.
3. Pilot on 2–3 laptops with Smart App Control **on** — confirm no block dialog.
4. Roll out via Intune / SCCM or `/download/desktop`.

### 5. CI / release pipeline (outline)

1. Store `CSC_LINK` as a secret (file path on self-hosted agent, or base64-encoded pfx in vault).
2. Store `CSC_KEY_PASSWORD` in CI secrets.
3. Run `npm run build:desktop:signed` on a **Windows** runner (signing requires Windows + `signtool`).
4. Upload artifacts + `latest.yml` if using auto-update.

Do **not** use `CSC_IDENTITY_AUTO_DISCOVERY=false` for signed builds — that flag is only for unsigned local builds (`build:desktop`).

### Smart App Control vs SmartScreen

| Symptom | Cause | Fix |
|---------|-------|-----|
| Smart App Control blocked app, no “Run anyway” | Unsigned or unknown publisher | Signed build with trusted cert |
| SmartScreen “Windows protected your PC” | Unsigned (older warning) | Same — sign the installer |
| Build works unsigned but employees blocked | Expected on Win11 SAC | `build:desktop:signed` before rollout |

**Do not** tell employees to disable Smart App Control in production — signing is the correct fix.

## Silent install (NSIS)

Interactive installer (employee double-clicks):

```text
AsbaTechs CRM Setup 0.1.0.exe
```

Silent install (IT deployment tools — SCCM, Intune, GPO script):

```cmd
"AsbaTechs CRM Setup 0.1.0.exe" /S
```

Optional: choose install directory (NSIS `oneClick: false`):

```cmd
"AsbaTechs CRM Setup 0.1.0.exe" /S /D=C:\Program Files\AsbaTechs CRM
```

> `/D=` must be the last parameter and must not be quoted.

Silent uninstall (after install, from registry uninstall string or):

```cmd
"%LOCALAPPDATA%\Programs\asbatechs-crm-desktop\Uninstall AsbaTechs CRM.exe" /S
```

Exact uninstall path may vary by install scope; verify on a test machine.

## Auto-start

The packaged app registers **Open at login** via Electron `setLoginItemSettings`. Employees do not need a Windows Scheduled Task.

## Auto-updates

When `DESKTOP_UPDATE_URL` is set, pass it at build time for auto-update metadata:

```bash
set DESKTOP_UPDATE_URL=https://downloads.example.com/crm/desktop
npm run build:desktop
```

Or add a `publish` block to `apps/desktop/package.json` for release pipelines.

- `latest.yml`
- `AsbaTechs CRM Setup x.x.x.exe` (or blockmap files generated by electron-builder)

CRM **UI** updates still come from your normal Next.js deploy — the shell only updates when you ship a new Electron build.

## Rollout checklist

- [ ] Deploy web CRM (`apps/web`) to production
- [ ] Set `NEXT_PUBLIC_DESKTOP_INSTALLER_URL` on the server
- [ ] Build signed installer (`CSC_LINK` + `CSC_KEY_PASSWORD`)
- [ ] Upload installer + `latest.yml` to download CDN
- [ ] Pilot with 2–3 employees (login, clock-in, lock laptop, verify dashboard monitor state)
- [ ] Distribute via Intune/SCCM or share `/download/desktop` link
- [ ] Deprecate legacy agent install instructions for new machines

## Verify monitoring (admin)

1. Open **Dashboard** or **Admin overview** → desktop monitor table
2. Employee should show monitor state **Running** after clock-in
3. **Last seen** source should show **Desktop App** (not raw `electron`)

## Legacy agent (migration only)

Keep `apps/desktop-agent` only for machines not yet migrated. Do not issue new PowerShell setup scripts for new hires.

## Development smoke test

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:desktop
```

Sign in as an **employee**, open Attendance, clock in, lock Windows briefly, unlock — dashboard should record sleep/activity via the desktop app main process.

## Troubleshooting

| Issue | Action |
|-------|--------|
| Login fails on `http://localhost:3000` in dev | Expected in production `secure` cookies; use production URL or dev without `NODE_ENV=production` |
| Monitor shows **Not installed** | Employee must use desktop app, not browser-only |
| Download page shows “not configured” | Set `NEXT_PUBLIC_DESKTOP_INSTALLER_URL` |
| SmartScreen warning | Sign the installer with a valid Authenticode certificate (`CSC_LINK`) — use `npm run build:desktop:signed` |
| Smart App Control blocked app | Same — unsigned builds are dev-only; see [Windows code signing](#windows-code-signing-production) |
| NSIS fails on PNG icon | Use a `.ico` file in `apps/desktop/assets/` or omit custom installer icons (default Electron icon is used) |
| Build fails extracting winCodeSign on Windows | Run terminal as Administrator, enable Developer Mode, or set `CSC_IDENTITY_AUTO_DISCOVERY=false` (already in `package:win` script) |
