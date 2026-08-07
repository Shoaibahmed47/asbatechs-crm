# Agent instructions (AsbaTechs CRM)

Read this file and `.cursor/rules/` before large changes. Prefer stack and patterns already used in the monorepo.

## Stack (do not invent parallel stacks)

| Layer | Choice |
|-------|--------|
| App | Next.js App Router (`apps/web`) — RSC, Server Actions, Route Handlers |
| UI | Tailwind, Shadcn/Radix |
| DB | PostgreSQL + Drizzle (`packages/database`) |
| Desktop | Electron app `apps/desktop` (attendance monitor built-in) |
| Deploy web | Vercel (Git → `main`). Production URL may differ from custom DNS (see Domains). |
| Desktop installers | GitHub Releases via `.github/workflows/desktop-release.yml` |

Monorepo: `apps/web`, `apps/desktop`, `packages/*`. pnpm-style workspaces via root `package.json` (npm workspaces).

## Agent behavior

- Match existing code style; small focused diffs; no drive-by refactors.
- Never commit secrets (`.env`, tokens, `crm-app.url` production URL secrets).
- Do not force-push `main`/`master` unless the user explicitly asks.
- Never skip hooks (`--no-verify`) unless the user explicitly asks.

### After every meaningful code change (default delivery pipeline)

**Order is mandatory:** Playwright (or unit) → build → commit → push.

When the user asked for a feature/fix/UI/API work (not pure Q&A), finish with:

1. **Playwright / tests**
   - Default: `npm run test:e2e` (public pages + API health + desktop download)
   - Targeted: `npm run test:e2e:api` and/or `npm run test:e2e:desktop`
   - Local: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e`
   - Prefer production verify host: `https://asbatechs-crm-web.vercel.app` (stale custom domains can 404 newer routes)
   - Server logic: also `npm --workspace apps/web test` when relevant
2. **Build** — `npm run build` or `npm --workspace apps/web run build` (must pass for web changes)
3. **Commit** — stage only intended files; skip secrets and noise (`next-env.d.ts`, `test-results/`)
4. **Push** — `git push origin HEAD` so Vercel / CI can pick up `main`

If the user only asked a question or said “do not commit/push”, skip that step.
If Playwright, build, or hooks fail: fix, re-run, then create a **new** commit (do not amend pushed commits).

Exception: desktop native package changes still need **Desktop Release** Action for the `.exe`; web push alone does not update employee installers.

## Attendance (critical product rules)

- **Tab close** tracking is disabled (`ATTENDANCE_TAB_CLOSE_ENABLED = false`) — employees use Desktop CRM, not browser tab away.
- **Sleep / lock**: Desktop monitor; **detect after 2 min** (desktop build), **count minutes after 6 min** (server `ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS`).
- During **manual Break** (namaz/dinner), Sleep/Lock does **not** start a second away session.
- Cursor idle is **off** (`ATTENDANCE_CURSOR_IDLE_ENABLED = false`).

## Desktop download for employees

- Public page: `/download/desktop` (served by middleware when needed to avoid stuck static HTML).
- API redirect: `/api/desktop/installer`.
- Installer asset name on GitHub uses **dots**, not spaces: `AsbaTechs.CRM.Setup.0.1.0.exe`.
- Default fallback URL lives in `apps/web/src/lib/desktop-installer-url.ts` and middleware.
- Web push updates Vercel only. **Desktop `.exe` changes** need GitHub Action **Desktop Release** + employees reinstall/update.
- Prefer / verify: `https://asbatechs-crm-web.vercel.app` for current Vercel production.
- Custom host (e.g. `app-asbatech-crm.betaserver.host`) only after Domains assign that host to **this** project Production — otherwise you may see stale deploys.

### Desktop UI mismatch (critical)

- **Download page new UI ≠ employee desktop UI.** The page is hosted on Vercel; the `.exe` loads whatever CRM origin was **baked** at release time (`CRM_APP_URL` secret → `apps/desktop/crm-app.url`).
- GitHub Actions secret **`CRM_APP_URL` must be** `https://asbatechs-crm-web.vercel.app` (no trailing slash) for employee installs to show current UI.
- After **Desktop Release** succeeds, **verify the baked URL inside the latest Setup `.exe`** (scan for `asbatechs-crm-web.vercel.app`). Action green alone is not enough — a wrong secret still ships old UI (`betaserver` / stale host).
- Developer PC may look “fixed” via local `userData/crm-app.url` while employees still get the old baked installer — always re-check Releases + employee reinstall.
- Legacy PowerShell/`ASBA Attendance Agent`: **disable**, do not delete, when Desktop CRM monitoring is in use (re-enable later if needed).

## Playwright / e2e

```bash
npm run test:e2e:install          # chromium once
npm run test:e2e                  # full suite (API health + desktop download + login shell)
npm run test:e2e:api              # public API smoke only
npm run test:e2e:desktop          # desktop installer page + redirect
PLAYWRIGHT_BASE_URL=https://asbatechs-crm-web.vercel.app npm run test:e2e
# or local:
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

- Config: `playwright.config.ts`, specs in `e2e/` (`api-health.spec.ts`, `desktop-download.spec.ts`).
- Default `PLAYWRIGHT_BASE_URL` should target a host that has the **latest** deploy (Vercel production or local), not a stale custom domain.
- Production APIs should return JSON (not HTML error pages). Protected routes without auth → `401` JSON. Public policy/auth/me → `200` JSON.
- After user-facing web or API changes, run full `test:e2e` **before** build/push.
- Unit tests: `npm --workspace apps/web test` (Jest). Middleware download case lives in `apps/web/src/middleware.test.ts`.

## GitHub Actions

- Desktop build: Actions → **Desktop Release** (needs secret `CRM_APP_URL` = `https://asbatechs-crm-web.vercel.app`, no trailing slash).
- After each release: confirm latest `.exe` contains that Vercel origin (not `betaserver` / stale hosts).
- Do not store large installers in git; use Releases artifacts only.
