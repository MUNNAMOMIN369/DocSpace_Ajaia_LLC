# DocSpace

DocSpace is a web-based document workspace for creating, editing, organizing, and selectively sharing personal documents. The React frontend talks to an Express API; PostgreSQL stores accounts, documents, and collaborator permissions.

## 1. Purpose

DocSpace brings document creation and basic collaboration into one account-backed workspace. It addresses scattered notes and files with a searchable document list, persistent editing, simple imports and exports, and explicit owner/editor/viewer access.

## 2. Features

- Email/password signup, login, logout, and session restoration.
- Persistent documents with debounced autosave.
- Rich-text documents, editable table-based spreadsheets, quick notes, presentation outlines, text-based whiteboard notes, and rich-text fallbacks for PDF-type items.
- Sharing with registered users as editors or viewers.
- TXT, Markdown, and `.markdown` imports.
- Type-appropriate PDF, DOCX, TXT, Markdown, HTML, CSV, and XLSX exports.
- Selection-based font-size increase, decrease, and reset controls.
- Account-scoped logical storage usage and per-document-type counts.
- Search, document-type filters, and responsive dashboard/editor layouts.

The spreadsheet editor does not calculate formulas. Slides are outlines, whiteboards are text-based, and PDF items do not have a PDF previewer. See [Current limitations](#25-current-limitations).

## 3. Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express 4, TypeScript, Zod |
| Database | Neon PostgreSQL, `pg`, Drizzle ORM and Drizzle Kit |
| Authentication | bcrypt password hashes, JWT, HTTP-only cookies |
| Exports | PDFKit, ExcelJS, html-to-docx, Turndown |

The backend package requires Node.js `>=20.18.1`.

## 4. System architecture

```text
Browser (React/Vite, src/)
  └── JSON requests and authenticated downloads
        └── Express API (server/src/)
              └── Drizzle ORM + node-postgres pool
                    └── PostgreSQL (Neon in the hosted setup)
```

The browser sends session cookies with API requests. Drizzle owns the schema and migration workflow; the server reuses a PostgreSQL connection pool.

## 5. Folder structure

```text
src/
  components/       React screens, dashboard, editor, dialogs, and UI
  lib/              App state, API calls, document types, and helpers
  utils/            Shared frontend utilities
server/
  src/config/       Environment validation
  src/db/           PostgreSQL pool, Drizzle instance, and schema
  src/lib/          JWT and cookie helpers
  src/middleware/   Authentication and error handling
  src/routes/       Auth and document API routes
  src/types/        Express request types
  drizzle/          SQL migrations and Drizzle metadata
  tests/            Node integration tests
docs/               Project audit and architecture documentation
```

## 6. Frontend/backend communication

In development, Vite serves the frontend on port `5173` by default and proxies `/api` to `http://localhost:4000`. If port 5173 is occupied, Vite selects and prints another available port; set `CLIENT_URL` to that exact origin when the proxy is not used.

The Express API listens on port `4000` by default. The frontend sends credentialed requests. `VITE_API_BASE_URL` is an optional development override; production builds use same-origin `/api` and do not point to localhost. The backend CORS policy allows the configured `CLIENT_URL` and credentials.

## 7. Authentication and authorization

1. Signup validates the name, email, and password, hashes the password with bcrypt cost 12, inserts the user, and issues a JWT.
2. Login looks up the normalized email, compares the password with bcrypt, and issues the same kind of session.
3. The JWT is held in the `docspace_session` HTTP-only cookie for seven days. It is `Secure` in production and uses `SameSite=Lax`.
4. On application load, the frontend calls `GET /api/auth/me`; on success it restores the user and loads their documents.
5. Logout clears the cookie. Protected routes verify the token on each request.

Owners can read, edit, delete, and manage sharing for their documents. Editors can read and edit; viewers can read but cannot edit. The backend enforces access against the database on each protected operation; frontend checks are not the security boundary.

## 8. Database design

- **`users`** stores the user ID, name, unique email, bcrypt hash, and timestamps.
- **`documents`** stores title, HTML content, excerpt, type, owner ID, sharing flag, and timestamps. Its owner foreign key cascades when a user is deleted.
- **`document_collaborators`** links a document to a registered user with an `editor` or `viewer` role. A unique document/user index prevents duplicate collaborator records; both foreign keys cascade on deletion.
- **`document_permissions`** retains the earlier permission-record model for compatibility. New email-based invitations use `document_collaborators`; existing permission rows are still considered by read/list access paths.

Drizzle schema definitions are in `server/src/db/schema.ts`. The SQL migration ledger is in `server/drizzle/meta/_journal.json`.

## 9. Document creation, editing, and autosave

The API accepts `doc`, `sheet`, `slides`, `pdf`, `note`, and `whiteboard` document types. New documents are owned by the signed-in user and returned to the frontend, which opens the editor. Rich-text content is stored as HTML. The basic spreadsheet is an editable HTML table; the other non-document types use documented text-oriented fallbacks rather than specialized slide, drawing, or PDF-editing engines.

Editor input and title changes are debounced for 700 ms and sent as authenticated `PATCH /api/documents/:id` requests. The UI displays saving, saved, or failed state. On reload, `/api/auth/me` restores the session and the documents API reloads persisted content. Deletion is permanent; there is no recoverable trash.

## 10. Sharing and collaboration

An owner invites an already registered user by email and chooses `editor` or `viewer`. Re-inviting an existing collaborator updates that user's role. Owners can list collaborators, change a role, and revoke access. Revocation is enforced on the next API request. Public links, comments, and real-time co-editing are not implemented.

## 11. Import and export

**Import:** The browser accepts `.txt`, `.md`, and `.markdown` files up to 500 KB each. Imported files become note-type documents. DOCX, PDF, image, HTML, and remote-drive imports are not supported.

**Export:**

| Document type | Available formats |
|---|---|
| Rich-text and text-fallback types | PDF, DOCX, TXT, Markdown, HTML |
| Spreadsheet (`sheet`) | PDF, CSV, XLSX |

Export requests require authentication and normal document read permission. Filenames are sanitized. CSV output quotes cells and prefixes formula-like values to reduce spreadsheet formula injection risk. Exports reflect the stored HTML/table content; spreadsheet formulas are not evaluated.

## 12. Font-size controls

The editor toolbar can increase or decrease the selected text's size by one pixel, or reset the selection to its inherited size. Sizes are clamped to 10–48 px. The resulting inline HTML formatting is saved through the normal autosave path; this is selection formatting, not a document-wide font preference.

## 13. Storage tracking

The authenticated storage endpoint sums PostgreSQL byte lengths for each owned document's title, content, and excerpt, then reports totals and counts by document type. With the database's UTF-8 encoding, this is a logical UTF-8 byte calculation. Shared-in documents and database/index/TOAST overhead are excluded. It is not a physical database-size measure, and the application does not enforce a storage quota.

The frontend refreshes usage after document changes, on explicit request, when the page regains focus/visibility, and every 60 seconds while authenticated. API: `GET /api/documents/storage`.

## 14. API endpoints

All document routes require the session cookie. JSON errors use `{ "ok": false, "message": "..." }`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api` | API name, version, and status |
| `GET` | `/api/health` | API and database health |
| `POST` | `/api/auth/signup` | Create an account and session; body: `name`, `email`, `password` |
| `POST` | `/api/auth/login` | Start a session; body: `email`, `password` |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Return the current authenticated user |
| `GET` | `/api/documents` | List owned and accessible shared documents |
| `GET` | `/api/documents/shared` | List shared documents |
| `GET` | `/api/documents/storage` | Return owned-document byte totals and per-type counts |
| `POST` | `/api/documents` | Create a document; optional body fields: `title`, `content`, `type`, `excerpt` |
| `GET` | `/api/documents/:id` | Read a document the user can access |
| `PATCH` | `/api/documents/:id` | Update title, content, type, or excerpt if the user can write |
| `DELETE` | `/api/documents/:id` | Permanently delete an owned document |
| `GET` | `/api/documents/:id/export/:format` | Export a readable document in a type-supported format |
| `GET` | `/api/documents/:id/collaborators` | List owner and collaborators |
| `POST` | `/api/documents/:id/collaborators` | Invite/update a registered user; body: `email`, `role` |
| `PATCH` | `/api/documents/:id/collaborators/:userId` | Change a collaborator's role; body: `role` |
| `DELETE` | `/api/documents/:id/collaborators/:userId` | Revoke collaborator access |

Invalid input returns a client error; missing documents return `404`, unauthenticated requests return `401`, and insufficient permissions return `403`. Export formats are validated against the document type.

## 15. Environment variables

The root `.env.example` contains placeholder values only. Do not commit `.env` files or put secrets in source control.

| Variable | Required/configuration | Description |
|---|---|---|
| `DATABASE_URL` | Required | PostgreSQL/Neon connection string |
| `JWT_SECRET` | Required; at least 12 characters | Secret used to sign session tokens; use a long random value |
| `PORT` | Optional; defaults to `4000` | Express listen port |
| `NODE_ENV` | Required | `development`, `test`, or `production`; set to `production` in production |
| `CLIENT_URL` | Required | Valid, exact allowed credentialed CORS origin (for local development, `http://localhost:5173`) |
| `VITE_API_BASE_URL` | Optional, development only | Alternate API base URL; production uses same-origin `/api` |

Configure `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, and `CLIENT_URL` in the hosting provider; all four are required at backend startup. Set `NODE_ENV=production` there. Never put their values in this README or `vercel.json`.

## 16. Prerequisites

- Node.js `20.18.1` or newer (required by the backend dependencies).
- npm.
- Git.
- A Neon PostgreSQL database or compatible PostgreSQL instance.

## 17. Local installation

```sh
git clone https://github.com/MUNNAMOMIN369/DocSpace_Ajaia_LLC.git
cd DocSpace_Ajaia_LLC
npm install
npm --prefix server install
```

Copy `.env.example` to `.env` in the repository root, set `DATABASE_URL` and `JWT_SECRET`, and keep `NODE_ENV` and `CLIENT_URL` configured. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not use the example placeholders as real credentials. Keep `.env` local; `.gitignore` excludes it.

## 18. Database setup and migrations

After setting the root `.env`, generate a migration when the Drizzle schema changes, apply pending migrations, and verify connectivity:

```sh
npm run db:generate
npm run db:migrate
npm run db:check
```

`npm run db` is also defined and runs the migration command. Migration `0002_ambiguous_shiver_man.sql` adds indexes for owner and user-based document lookups; it is additive and does not reset tables or delete rows. In the database inspected for this README, migration `0002` was not present in the Drizzle migration ledger and its four indexes were absent. Apply it with `npm run db:migrate` before relying on that database's current schema/index state. Production migration status must be checked separately.

## 19. Start the development servers

The frontend and backend run in separate terminals; the root `dev` script starts only Vite.

**Terminal 1 — backend:**

```sh
npm run dev:server
```

**Terminal 2 — frontend:**

```sh
npm run dev
```

The backend defaults to `http://localhost:4000`; Vite defaults to `http://localhost:5173` and prints the actual URL if it selects another port. The health endpoint is `GET http://localhost:4000/api/health`; a healthy response reports database connectivity.

## 20. Tests and checks

Run the TypeScript checks and builds from the project root:

```sh
npm run typecheck
npm run typecheck:server
npm run build
npm run build:server
```

The sharing/auth integration test is `npm run test:sharing` (also the root `npm test` command). The storage/export integration test is:

```sh
npm --prefix server run test:exports
```

Both integration tests need a reachable backend and configured test database. They create random disposable accounts and remove their generated records. By default tests call `http://localhost:4000`; to test through Vite's same-origin `/api` proxy, set `DOCSPACE_API_URL` before running them:

```powershell
$env:DOCSPACE_API_URL = "http://localhost:5173"
npm run test:sharing
npm --prefix server run test:exports
```

The test files use Node's built-in test runner. There is no configured frontend unit-test runner. `npm run db:check` verifies the database connection; `npm run db:generate` reports whether schema changes need a new migration.

## 21. Production builds

```sh
npm run build
npm run build:server
npm --prefix server run start
```

The frontend build is written to `dist/`; the backend TypeScript build is written under `server/dist/`. The backend package uses ESM (`"type": "module"`) and NodeNext TypeScript output.

## 22. Vercel deployment notes

`vercel.json` declares two Vercel Services: the Vite frontend rooted at `.`, and the Express backend rooted at `server/` with `src/index.ts` as its entrypoint. `/api/*` is routed to the server service and other paths to the frontend service for SPA routing.

This configuration is a deployment target, not a verified deployment. Before release, connect the repository to Vercel, configure the production environment variables, apply pending migrations, and verify the service roots/builders, cookie/CORS behavior, API routing, health endpoint, authentication, and SPA fallback on a preview deployment.

## 23. Security considerations

- Store database URLs and JWT secrets only in environment variables or hosting-provider secret settings.
- Passwords are stored as bcrypt hashes; the API does not return password hashes.
- Session tokens are in HTTP-only cookies; production cookies use `Secure` and `SameSite=Lax`.
- Protected routes verify the JWT and check document ownership/collaborator access on the server.
- Exported HTML is sanitized, filenames are normalized, and CSV formula-like cells are prefixed.
- Use HTTPS in production and a strong, unique JWT secret. Do not use personal accounts as test fixtures.

## 24. Error handling

The API validates environment variables at startup and validates request bodies with Zod. It returns JSON errors for validation, authentication, authorization, missing routes/documents, and server failures. Database connection verification is exposed through `/api/health`; credentials and database URLs are not intentionally included in health responses.

## 25. Current limitations

- No public share links, comments, live co-editing, version history, or recoverable trash.
- Spreadsheet cells are editable, but formulas are not calculated.
- Presentation documents are text outlines; whiteboards are text notes, not drawing canvases.
- PDF-type documents use a rich-text fallback; there is no PDF viewer/editor.
- Imports are limited to TXT and Markdown variants; DOCX/PDF parsing and images are unsupported.
- No storage quota, subscription billing, SSO, profile editing, workspace switching, or persisted starred state.
- Service-status, legal, billing, and activity-notification surfaces are not configured.
- The Vercel deployment and production database/migration state have not been independently verified.

## 26. Future improvements

- Add focused frontend component and browser automation suites.
- Add version history, recoverable deletion, and richer document-specific editors.
- Add operational monitoring, backup/restore procedures, and production migration verification.
- Add collaboration comments and real-time editing if required by the product.
- Add quotas, billing, profile preferences, and SSO only with explicit product requirements.
