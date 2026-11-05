# DocSpace Architecture

## System overview

The application keeps the existing React 19 + TypeScript + Vite + Tailwind CSS 4 frontend under `src/`. The Express 4 + TypeScript backend is isolated under `server/`. The backend connects to PostgreSQL (Neon in the hosted setup) through `pg` and Drizzle ORM. The browser calls the API with `credentials: "include"`; the backend permits the configured `CLIENT_URL` and credentialed CORS.

```text
React UI (src/)
  -> HTTP API + HTTP-only session cookie
Express API (server/src/)
  -> Drizzle ORM
Neon PostgreSQL
```

## Authentication

Signup validates input with Zod, hashes passwords with bcrypt, stores the hash in `users.password_hash`, and returns a JWT session cookie. Login compares the submitted password with the stored hash. The cookie is HTTP-only, lasts seven days, and is marked Secure in production. `requireAuth` verifies the JWT and places the user identity on the Express request. Logout clears the cookie; `/api/auth/me` returns the current session user.

## Database relationships

- `users`: account identity and bcrypt password hash.
- `documents`: title, HTML content, type, owner FK, and timestamps. Deleting the owner cascades to owned documents.
- `document_collaborators`: one document/user pair with `editor` or `viewer` role. Both foreign keys cascade on deletion. Migration `0001_naive_the_hunter` adds a unique index to prevent duplicate pairs.
- `document_permissions`: pre-existing permission records retained for compatibility with the earlier schema/API. New email-based sharing uses `document_collaborators`.

## Document operations

All document API routes require authentication. Create assigns the authenticated user as owner. List returns owned and shared records. Read and update first resolve access from the owner, collaborator, or legacy permission record. Owners and editors can update; viewers can only read. Only owners can delete, and deletion is permanent (there is no soft-delete or recovery flow). A user with no access receives `403`; missing documents receive `404`; missing/invalid sessions receive `401`.

The frontend hydrates documents from the API and saves editor updates after a debounce. The editor displays `Saving`, `Saved`, or `Save failed` based on API responses. The client tracks request sequence numbers to ignore stale responses when updating local state; the database is the source of truth.

## Sharing and authorization

An owner submits a registered user's email and an editor/viewer role to `POST /api/documents/:id/collaborators`. A conflict on the unique document/user key updates the role instead of inserting a duplicate. Owner-only endpoints list, change, and revoke collaborators. Each protected request checks current database state, so revoked access is rejected on the next API request. `GET /api/documents/shared` returns documents associated with the current user's collaborator records (plus legacy permission rows).

The UI shows collaborator identity and role, but frontend checks are convenience only. The backend remains the authorization boundary.

## File import

The browser import dialog accepts multiple `.txt`, `.md`, and `.markdown` files, with a 500 KB per-file limit. Extension and size are checked before reading. Plain text is HTML-escaped. Markdown is converted by a small allowlisted syntax converter after escaping source text; supported constructs include headings, lists, emphasis, inline code, and paragraphs. Each document is sent through the normal authenticated document-create API. Only a successful API response is added to the frontend list.

DOCX, PDF, images, remote drive imports, and general HTML imports are not supported. The importer does not interpret source HTML as editor markup.

## Important decisions and boundaries

- Preserve the existing frontend rather than replacing its component system or design.
- Keep credentials in environment variables; `.env` is ignored and `.env.example` uses placeholders.
- Keep collaborator roles small and explicit (owner is derived from document ownership, not assigned as a collaborator role).
- Avoid public share links; unguessable IDs are not treated as authorization.
- Starred state and dashboard preferences are not persisted; the UI identifies these limitations rather than claiming server-backed settings.
- Vite/Render deployment is documented as a target only; no deployment has been completed or verified.
- The project currently has no configured general frontend unit-test runner. A Node built-in integration test exercises auth and sharing against a running API/database.
