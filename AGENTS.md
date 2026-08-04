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

When the user asked for a feature/fix/UI work (not pure Q&A), finish with:

1. **Verify** — run the smallest relevant checks:
   - Web UI / middleware / download: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:desktop` and/or `npm --workspace apps/web test`
   - If `npm run build` is feasible and unrelated noise is low, run `npm run build` (or workspace web build)
2. **Commit** — stage only intended files; skip secrets and noise (`next-env.d.ts` unless required)
3. **Push** — `git push origin HEAD` (or current branch) so Vercel / CI can pick up `main`

If the user only asked a question or said “do not commit/push”, skip that step.
If hooks fail, fix and create a **new** commit (do not amend pushed commits).

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

## Playwright / e2e

```bash
npm run test:e2e:install          # chromium once
PLAYWRIGHT_BASE_URL=https://asbatechs-crm-web.vercel.app npm run test:e2e:desktop
# or local:
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:desktop
```

- Config: `playwright.config.ts`, specs in `e2e/`.
- Default `PLAYWRIGHT_BASE_URL` should target a host that has the **latest** deploy (Vercel production or local), not a stale custom domain.
- After user-facing web changes to download/attendance public pages, run desktop e2e smoke before considering done.
- Unit tests: `npm --workspace apps/web test` (Jest). Middleware download case lives in `apps/web/src/middleware.test.ts`.

## GitHub Actions

- Desktop build: Actions → **Desktop Release** (needs secret `CRM_APP_URL`, clean HTTPS origin, no trailing slash).
- Do not store large installers in git; use Releases artifacts only.
