# DocSpace

DocSpace is a document workspace with a React editor, server-backed document storage, cookie-based authentication, and owner-managed collaborator sharing.

## Features

- Signup, login, logout, and current-session APIs.
- PostgreSQL-backed document create, list, read, update, and delete operations.
- Debounced editor autosave with server-confirmed status.
- Share documents with registered users as editors or viewers.
- TXT, Markdown, and `.markdown` import, limited to 500 KB per file.
- Protected Express API routes and Neon PostgreSQL persistence.

Sharing is restricted to registered users. Public links, comments, DOCX/PDF parsing, and real-time co-editing are not implemented.
Subscription billing, SSO, activity notifications, storage quota tracking, workspace switching, legal pages, and hosted service-status monitoring are also not configured.
Document deletion is permanent (there is no recoverable trash); starred status lasts only for the current browser session. PDF export, profile editing, and configurable preferences are not implemented.

## Technology

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Lucide React.
- Backend: Node.js, Express 4, TypeScript, Zod.
- Data: Neon PostgreSQL, Drizzle ORM and Drizzle Kit.
- Authentication: bcrypt password hashes, JWT in an HTTP-only cookie.

## Project layout

```text
src/                  React application and UI
server/src/           Express app, auth, document routes, database schema
server/drizzle/       Generated PostgreSQL migrations
docs/                 Audit and implementation documentation
```

## Requirements and local setup

Use Node.js 20 or newer and npm. The API needs a PostgreSQL connection string; Neon is the supported hosted database.

1. Install frontend dependencies with `npm install`.
2. Install backend dependencies with `npm --prefix server install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` and a private random `JWT_SECRET` (at least 12 characters). The other variable names and local defaults are listed in `.env.example`.
4. Apply migrations with `npm run db:migrate` (or `npm --prefix server run db`).
5. In one terminal run `npm run dev:server`; in another run `npm run dev`.
6. Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

Do not commit `.env` or paste credentials into source code. For a non-local frontend origin, set `CLIENT_URL` to that exact origin. Local Vite development defaults its API URL to `http://localhost:4000` (or uses the optional `VITE_API_BASE_URL` override); production builds always use same-origin `/api` requests and ignore that override.

## Environment variables

| Name | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL/Neon connection string |
| `JWT_SECRET` | Backend | Signing key for session tokens |
| `PORT` | Backend | HTTP listen port (defaults to `4000`) |
| `NODE_ENV` | Backend | `development`, `test`, or `production` |
| `CLIENT_URL` | Backend | Allowed credentialed CORS origin |
| `VITE_API_BASE_URL` | Frontend build | Optional backend API base URL |

`.env.example` contains placeholders only. Configure production secrets in the hosting provider's environment settings.

## Database

From the project root:

```sh
npm run db:generate
npm run db:migrate
npm run db:check
```

The schema includes users, documents, document collaborators, and legacy document permissions. Collaborator records are unique per document/user pair. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for relationships and access rules.

## API overview

All document endpoints require the session cookie unless explicitly noted.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create account and session |
| `POST` | `/api/auth/login` | Start session |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/me` | Current authenticated user |
| `GET` | `/api/documents` | List owned and shared documents |
| `POST` | `/api/documents` | Create a document |
| `GET` | `/api/documents/shared` | List documents shared with current user |
| `GET` | `/api/documents/:id` | Read a document |
| `PATCH` | `/api/documents/:id` | Update title/content/type |
| `DELETE` | `/api/documents/:id` | Delete an owned document |
| `GET` | `/api/documents/:id/collaborators` | List people with access |
| `POST` | `/api/documents/:id/collaborators` | Add or update a registered user's role |
| `PATCH` | `/api/documents/:id/collaborators/:userId` | Change editor/viewer role |
| `DELETE` | `/api/documents/:id/collaborators/:userId` | Revoke collaborator access |
| `GET` | `/api/health` | API and database health |

Only owners manage collaborators. Editors can read and edit; viewers can read only. Access checks are performed against the database for each protected operation.

## Scripts and checks

```sh
npm run dev                 # Vite frontend
npm run dev:server          # Express backend
npm run build               # Frontend production build
npm run typecheck           # Frontend TypeScript check
npm run build:server        # Backend TypeScript build
npm run typecheck:server    # Backend TypeScript check
npm run test:sharing        # Live sharing/auth integration test
npm run db:check            # Verify Neon/PostgreSQL connection
```

The sharing integration test requires a running backend and configured Neon/PostgreSQL database. It creates two random temporary users, verifies independent sessions and role changes, and removes its test users and document afterward.

There is no configured frontend unit-test runner or separate authentication/document CRUD test suite at this time.

## Deployment

Deployment has not been performed or verified. The root [vercel.json](./vercel.json) configures Vercel Services (currently Beta) with the Vite frontend rooted at `.` and the Express backend rooted at `server/`. Requests under `/api/` route to the backend; other requests route to the frontend, whose service rewrite supports SPA deep links.

Before deploying:

- Connect this repository to a Vercel project with the repository root as the project root.
- The backend service uses Vercel's Express builder with `src/index.ts` as its entrypoint; keep the service root set to `server/`. The package declares `"type": "module"` and TypeScript uses `NodeNext` so the Express entrypoint remains ESM.
- Set `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, and `CLIENT_URL` in the Vercel project environment. Use the same public origin for `CLIENT_URL`; do not store secrets in `vercel.json`.
- Leave `VITE_API_BASE_URL` unset to use same-origin `/api` routes, or set it only when intentionally using a separate API origin.
- Apply Drizzle migrations to the Neon database with `npm run db:migrate` before serving traffic.
- Verify signup, login, cookies, database access, and SPA deep links on a Vercel preview before promoting a production deployment.

Vercel deployment and the production cookie/CORS behavior have not been tested. No live URLs are listed.
