# Asbatechs CRM Monorepo

Full-stack CRM with:

- Frontend: Next.js + React + TypeScript + MUI
- Backend: NestJS + PostgreSQL + Drizzle ORM

## Local development

1. Install dependencies at the repo root:

```bash
npm install
```

2. Set up PostgreSQL and environment variables:

- Create a local PostgreSQL database (e.g. `asbatechs_crm`).
- Copy `backend/.env.example` to `backend/.env` and update `DATABASE_URL`, `JWT_SECRET`, etc.
- Copy `frontend/.env.local.example` to `frontend/.env.local` if needed.

3. Run backend migrations (from repo root):

```bash
cd backend
npx drizzle-kit migrate
cd ..
```

4. Start backend and frontend (from repo root):

```bash
npm run dev:backend
npm run dev:frontend
```

Or run both at once:

```bash
npm run dev
```

## AWS EC2 (high level)

- Provision an Ubuntu EC2 instance.
- Install Node.js, Git, Nginx, and configure a managed PostgreSQL (RDS) instance.
- Clone this repository and set production `.env` files in `backend/` and `frontend/`.
- Run `npm install` at the root, then:
  - `npm run build:backend` and start backend with a process manager (PM2 or systemd).
  - `npm run build:frontend` and `npm run start:frontend`.
- Configure Nginx to:
  - Serve the frontend on `/`.
  - Proxy `/api` (or backend path) to the NestJS backend port.

