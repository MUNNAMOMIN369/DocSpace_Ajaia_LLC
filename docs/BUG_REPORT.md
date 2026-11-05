# DocSpace Bug Report

## Summary

The current application is a high-fidelity frontend prototype, but it contains several issues that prevent it from meeting the project requirements or behaving like a production-ready document collaboration app.

## Critical issues

### 1. No persistent backend or database layer

- Status: Critical
- Evidence: There are no backend folders, no Express app, no PostgreSQL configuration, and no Drizzle schema or migrations.
- Impact: Users cannot truly create, save, share, or retrieve documents beyond the lifetime of the browser session.
- Required fix: Add a real Node.js/Express API and Neon PostgreSQL persistence layer.

### 2. Authentication is simulated and insecure

- Status: Critical
- Evidence: `login()` in `src/lib/app-context.tsx` simply flips `authenticated` to `true` without validation or session storage.
- Impact: No real user identity, token issuance, session control, or authorization checks exist.
- Required fix: Implement JWT issuance, secure HTTP-only cookies, bcrypt hashing, and middleware-based auth.

### 3. Document state is not persisted beyond UI memory

- Status: Critical
- Evidence: `INITIAL_DOCS` and React state hold all document data in memory.
- Impact: Refreshing the app resets the workspace, and user changes are lost.
- Required fix: Replace the in-memory store with database-backed CRUD APIs.

## High-priority issues

### 4. Import functionality is not production-grade

- Status: High
- Evidence: `importFiles()` reads file text as plain text and creates fake HTML previews; it does not parse DOCX/Markdown/TXT using the project’s required stack.
- Impact: External file ingestion is inaccurate and cannot meet the requirement for importable documents.
- Required fix: Integrate Mammoth.js and markdown/text parsing logic with appropriate document conversion.

### 5. Sharing and collaboration logic is cosmetic only

- Status: High
- Evidence: The share modal and collaborator lists are UI-only state and do not enforce or store permissions.
- Impact: No real permission model exists for viewers/editors/owners.
- Required fix: Create document collaborators and permission records in PostgreSQL and enforce them server-side.

### 6. Editor stack does not match the specification

- Status: High
- Evidence: The editor uses `document.execCommand`, which is legacy and not the required Tiptap-based document editor.
- Impact: The document editor does not match the project’s technical requirements and is fragile across browsers.
- Required fix: Migrate to Tiptap with structured content and proper document formatting support.

### 7. Testing and verification are not present

- Status: High
- Evidence: There are no Vitest, Supertest, RTL, or Playwright tests and no automated smoke checks.
- Impact: The app cannot prove correctness or safe regression prevention.
- Required fix: Add end-to-end and API-level tests with CI-ready scripts.

## Medium-priority issues

### 8. Rename action is incomplete in the document card menu

- Status: Medium
- Evidence: The menu calls `window.prompt()` but does not actually call `renameDoc()` to update the document title in state.
- Impact: The UX suggests a rename capability that is not implemented.
- Required fix: Wire the menu action to the central rename callback and update the document state.

### 9. Search, filtering, and analytics are local-only

- Status: Medium
- Evidence: Search and filter logic operate only on the current in-memory list.
- Impact: Real collaboration and document volume are not represented.
- Required fix: Move advanced filtering and search to backend queries or server-side filtering.

### 10. Deployment and environment configuration are absent

- Status: Medium
- Evidence: No `README`, no environment file examples, and no deployment config for Render/Vercel/Neon.
- Impact: The project cannot be deployed and cannot be handed off for production use.
- Required fix: Add deployment scripts, docs, and environment examples.

## Observed positive notes

- Build health is currently good: `npm run build` succeeds.
- The UI foundation is strong and visually well-crafted.
- The app has a clear product story and usable design language which should be preserved during implementation.

## Recommended next steps

1. Establish backend architecture and PostgreSQL schema.
2. Replace mock auth with real authentication and session management.
3. Replace in-memory document state with database-backed APIs and type-safe queries.
4. Migrate to Tiptap and implement real document persistence.
5. Add import processing and permission enforcement.
6. Add tests and deployment guidance.
