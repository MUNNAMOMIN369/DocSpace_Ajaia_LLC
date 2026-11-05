# DocSpace Submission

## Project

**DocSpace** is a white-and-orange collaborative document workspace. It preserves the existing React editor and connects user authentication, document storage, and collaborator permissions to an Express API and PostgreSQL database.

## Project links

- Frontend: **Not deployed** — URL: `[add live frontend URL after deployment]`
- Backend: **Not deployed** — URL: `[add live API URL after deployment]`
- Repository: `[add repository URL]`
- Walkthrough video: `[add video URL]`

No live deployment or repository URL was verified during this work.

## Test account instructions

Create separate accounts from the application's Sign up screen to test sharing. To exercise permissions, sign up as Alice, create a document, then share it with the email of a second registered account (Bob). The integration test creates random temporary users and removes them when it completes; it does not create reusable credentials.

## Completed features

- Signup, login, logout, and authenticated current-user API.
- PostgreSQL-backed document create, read, update, list, and delete APIs.
- Cookie-session-protected document routes.
- Owner-managed sharing with registered users as editor or viewer.
- Backend-enforced role access and collaborator revocation.
- TXT, Markdown, and `.markdown` import with size and extension checks.
- Drizzle schema/migration for unique collaborator records.

## Verification snapshot

- **PASS** — `npm run build`: Vite production build completed successfully.
- **PASS** — `npm run typecheck`: frontend TypeScript check completed successfully.
- **PASS** — `npm --prefix server run typecheck`: TypeScript check completed successfully.
- **PASS** — `npm --prefix server run build`: backend production build completed successfully.
- **PASS** — `npm run db:generate`: no schema changes remained to generate.
- **PASS** — `npm run db`: migrations applied successfully to the configured database.
- **PASS** — `npm run db:check`: PostgreSQL connection verified.
- **PASS** — `npm run test:sharing`: 1 integration test passed, 0 failed. It used independent Alice/Bob cookie sessions. Signup returned `201` for each user; login and current-user returned `200`; logout returned `200` and the next current-user request returned `401`. Document create returned `201`; rename, reload/read, editor update/readback, and owner delete returned `200`. Editor content updates returned `200`; viewer edits and collaborator management returned `403`; role changes and revocation returned `200`; the revoked user's document read returned `403` and shared-document list no longer contained it. Invalid/unregistered/self-role cases returned `404`/`400` as expected.
- **PASS (prior browser verification)** — TXT and Markdown imports were saved through the UI and remained after page reload. Empty Markdown was accepted; PDF and a 500,001-byte file were rejected; imported `<script>` text rendered as text rather than executable markup.
- **PASS** — After signing out the existing local test account, browser verification found the login form visible, email/password values empty, and no demo account/SOC 2/trial text. After a clean reload, no page errors, console errors, or HTTP 5xx responses were observed.
- Database commands emitted a PostgreSQL SSL-mode deprecation warning for `sslmode=require`; connections and migrations still succeeded.
- `.env.example` was checked and corrected to use placeholder-only database credentials and JWT secret. `.env` is ignored by `.gitignore`; this workspace has no Git metadata, so tracked-file/commit-level secret status could not be verified.

## Known limitations

- Not deployed; Vercel and Render are targets only.
- No DOCX or PDF import, public sharing links, comments, or real-time collaborative editing.
- No general frontend unit-test runner or automated Playwright test suite is configured.
- The production HTTP-only cookie and CORS setup has not been tested on separate deployed Vercel/Render origins.
- Billing, plan changes, storage quota tracking, SSO, activity notifications, workspace switching, legal pages, and hosted service status are not configured.
- Trash recovery, PDF export, profile editing, and configurable preferences are not implemented; delete is permanent and starred state is session-only.
- The frontend build and backend checks passed, but there is no separate automated authentication/CRUD test suite beyond the sharing integration test's auth and document-operation coverage.
- The prior browser import smoke test used an `Import Tester` account and confirmed imported files persisted. Those browser-created database documents were not removed, so clean them from that test account before using it as a clean demo workspace if needed.
