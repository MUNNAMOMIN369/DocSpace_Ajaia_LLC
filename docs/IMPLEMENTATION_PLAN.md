# DocSpace Implementation Plan

## Phase 1 — Foundation and audit sign-off

### Goal

Confirm the current status of the repository and preserve the strongest existing UI work while scoping the production implementation.

### Acceptance criteria

- Current repo inspected and audited.
- Required docs generated: `PROJECT_AUDIT.md`, `BUG_REPORT.md`, and `IMPLEMENTATION_PLAN.md`.
- Existing design language and feature intent preserved.
- Implementation scope agreed and approved before backend work begins.

## Phase 2 — Backend scaffolding

### Goal

Create the production backend required by the assignment.

### Deliverables

- `server/` folder with Express app entrypoint.
- TypeScript config for backend.
- Environment variable management via `.env.example`.
- Health check route and application bootstrap.
- API structure for auth, documents, collaborators, imports, and sharing.

### Technical choices

- Node.js + Express + TypeScript
- PostgreSQL via Neon
- Drizzle ORM
- JWT with HTTP-only cookies
- Zod for validation
- bcrypt for password hashing

### Acceptance criteria

- `npm run dev` starts backend with a health endpoint.
- Database connection is configured with Neon connection strings.
- Server-side validation protects routes.

## Phase 3 — Database and schema design

### Goal

Design and implement the persistent relational model.

### Tables

- users
- documents
- collaborators
- permissions
- document_versions
- activity_log
- files

### Requirements

- Primary keys and foreign keys
- Unique constraints and indexes
- Drizzle schema definitions
- SQL migration scripts
- Type-safe queries

### Acceptance criteria

- Database initialization works with a new schema.
- Users can create documents and assign collaborators.
- Permission states are enforced in the DB and API.

## Phase 4 — Authentication and authorization

### Goal

Replace the mock login flow with secure user authentication.

### Deliverables

- User registration and login endpoints
- JWT token creation and cookie storage
- Protected middleware for authenticated requests
- Password hashing with bcrypt
- Role-based or permission-based document access checks

### Acceptance criteria

- User can register and log in via API.
- Authenticated requests include valid session cookies.
- Unauthorized users cannot access protected document routes.

## Phase 5 — Document CRUD and collaboration

### Goal

Replace in-memory state with persistent document resources.

### Deliverables

- Create, read, update, delete document endpoints
- Rename and metadata update endpoints
- Owner/editor/viewer permission model
- Shared document retrieval based on user access
- Search and filtering by document metadata

### Acceptance criteria

- Documents persist after page refresh.
- Shared documents are retrieved based on permission state.
- Collaborator role updates respect access rules.

## Phase 6 — Rich text and file import pipeline

### Goal

Align the editor with the required project stack and import requirements.

### Deliverables

- Tiptap editor integration in the existing editor surface
- Auto-save with server sync
- Import support for DOCX, Markdown, and TXT files
- HTML or JSON document serialization based on editor needs

### Technical stack

- Tiptap
- Mammoth.js for DOCX
- Markdown parser for MD files
- Text parsing for plain TXT files

### Acceptance criteria

- User can import supported text-based and DOCX files.
- Imported content becomes a valid document in the workspace.
- Editor changes are safely preserved and reloaded.

## Phase 7 — Testing and quality assurance

### Goal

Prove correctness and prevent regressions.

### Test layers

- Unit tests for validation and helper logic
- API tests with Supertest
- Frontend component tests with React Testing Library
- Smoke tests with Playwright

### Acceptance criteria

- Full backend route smoke tests pass.
- Core editor and document workflows pass UI tests.
- The app builds without failing TypeScript checks.

## Phase 8 — Deployment and handoff

### Goal

Prepare the project for professional deployment.

### Deliverables

- Frontend deployment config for Vercel
- Backend deployment config for Render
- Neon PostgreSQL configuration documentation
- README with setup steps
- Architecture documentation
- AI workflow documentation
- Walkthrough video guidance or brief

### Acceptance criteria

- Frontend and backend can be deployed independently.
- Production environment variables are documented.
- App is running against Neon PostgreSQL in a real environment.

## Dependencies and sequencing

- Phase 1 must be reviewed before moving to backend work.
- Phase 2 must be implemented before document persistence.
- Phase 3 must be complete before auth and access control are finalized.
- Phase 4 and 5 should be validated together.
- Phase 6 requires the data model to be stable.
- Phase 7 and 8 are final acceptance gates.

## Risk highlights

- Without a backend, the app cannot satisfy the assignment even when the UI looks polished.
- Replacing a prototype editor with Tiptap mid-project can cause content migration issues unless data models are planned early.
- File import and collaboration require clear permission and schema design before implementation.

## Recommended next milestone

Proceed to backend scaffolding and schema design only after the audit findings are accepted and the design-preserving implementation plan is signed off.
