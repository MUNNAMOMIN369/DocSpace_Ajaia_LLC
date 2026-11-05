export type DocType = "doc" | "sheet" | "slides" | "pdf" | "note" | "whiteboard";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: "viewer" | "commenter" | "editor" | "owner";
}

export interface DocItem {
  id: string;
  title: string;
  excerpt: string;
  content: string; // HTML
  type: DocType;
  owner: string;
  updatedAt: string; // ISO
  createdAt: string;
  starred: boolean;
  shared: boolean;
  sharedWithMe?: boolean;
  trashed: boolean;
  collaborators: Collaborator[];
  tags: string[];
  wordCount: number;
  readMinutes: number;
  cover?: "orange" | "peach" | "sand" | "clay" | "cream" | null;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  kind: "success" | "info" | "warning" | "error";
}

export type ViewKey =
  | "home"
  | "recent"
  | "starred"
  | "shared"
  | "templates"
  | "trash"
  | "settings";

export const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-600",
  "bg-stone-500",
  "bg-orange-700",
  "bg-yellow-600",
  "bg-lime-700",
];

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

const now = Date.now();
const H = 3600_000;
const D = 24 * H;

function C(id: string, name: string, email: string, avatarColor: string, role: Collaborator["role"]): Collaborator {
  return { id, name, email, avatarColor, role };
}

export const CURRENT_USER: {
  name: string;
  email: string;
  plan?: string;
  storageUsedGb?: number;
  storageTotalGb?: number;
} = {
  name: "DocSpace User",
  email: "",
};

export const TEAM: Collaborator[] = [
  C("u1", "Amara Osei", "amara@docspace.io", "bg-orange-500", "owner"),
  C("u2", "Jonas Weber", "jonas@docspace.io", "bg-emerald-600", "editor"),
  C("u3", "Priya Nair", "priya@docspace.io", "bg-rose-500", "editor"),
  C("u4", "Diego Fuentes", "diego@docspace.io", "bg-amber-500", "commenter"),
  C("u5", "Sofia Marchetti", "sofia@docspace.io", "bg-stone-500", "viewer"),
  C("u6", "Liam Carter", "liam@docspace.io", "bg-orange-700", "editor"),
];

const html = (body: string) =>
  `<h1>Untitled</h1><p>${body}</p>`.replace("<h1>Untitled</h1>", "");

export const INITIAL_DOCS: DocItem[] = [
  {
    id: "d1",
    title: "Q4 Product Strategy — DocSpace Growth",
    excerpt: "Objectives, key results, and roadmap priorities for the final quarter. Includes pricing experiments and activation targets.",
    content: `<h1>Q4 Product Strategy — DocSpace Growth</h1><p>Our focus this quarter is <strong>activation</strong> and <strong>retention</strong>. We will ship three flagship bets: real-time presence, offline-first editing, and a rebuilt template gallery.</p><h2>Objectives</h2><ul><li>Raise weekly active editors from 41% to 58%</li><li>Cut time-to-first-share below 4 minutes</li><li>Launch Business plan with SSO and audit logs</li></ul><blockquote>“Make the first document feel magical — every pixel should earn trust.”</blockquote><h2>Key initiatives</h2><ol><li>White + Orange identity rollout across all surfaces</li><li>Instant search with keyboard-first command palette</li><li>Share links with granular permissions</li></ol><p>Owners update progress every Friday. Use <code>Cmd+S</code> to save a named version before major edits.</p>`,
    type: "doc",
    owner: "Amara Osei",
    updatedAt: new Date(now - 2 * H).toISOString(),
    createdAt: new Date(now - 21 * D).toISOString(),
    starred: true,
    shared: true,
    trashed: false,
    collaborators: [TEAM[0], TEAM[1], TEAM[2], TEAM[3]],
    tags: ["Strategy", "Q4"],
    wordCount: 1240,
    readMinutes: 6,
    cover: "orange",
  },
  {
    id: "d2",
    title: "Design System — White + Orange Tokens",
    excerpt: "Canonical color tokens, shadows, focus rings and glassmorphism rules for the new premium identity.",
    content: `<h1>Design System — White + Orange Tokens</h1><p>This document is the source of truth for the <strong>White + Premium Orange</strong> system. Orange is the only brand accent.</p><h2>Color tokens</h2><ul><li><code>--color-primary: #F97316</code> — buttons, active icons</li><li><code>--color-primary-hover: #EA580C</code></li><li><code>--color-primary-active: #C2410C</code></li><li><code>--color-primary-light: #FFF7ED</code> — hovers & sidebar active</li><li><code>--color-border: #E9EEF5</code></li></ul><h2>Rules</h2><ol><li>No purple, indigo, violet or blue as brand color</li><li>Cards lift 4px on hover with orange-tinted shadow</li><li>Glass: 82% white, 16px blur, soft navy shadow</li></ol>`,
    type: "doc",
    owner: "Jonas Weber",
    updatedAt: new Date(now - 5 * H).toISOString(),
    createdAt: new Date(now - 40 * D).toISOString(),
    starred: true,
    shared: true,
    trashed: false,
    collaborators: [TEAM[1], TEAM[0], TEAM[5]],
    tags: ["Design", "Tokens"],
    wordCount: 860,
    readMinutes: 4,
    cover: "peach",
  },
  {
    id: "d3",
    title: "Launch Checklist — 2.0 Release",
    excerpt: "Pre-flight checklist covering QA, comms, status page, billing and rollback plan for the 2.0 launch.",
    content: `<h1>Launch Checklist — 2.0 Release</h1><h2>Engineering</h2><ul><li>Freeze deploys 24h before launch</li><li>Verify migrations on staging clone</li><li>Load-test share-link resolution</li></ul><h2>Comms</h2><ul><li>Changelog drafted and reviewed</li><li>Status page scheduled maintenance</li><li>Lifecycle emails QA'd</li></ul><p>Rollback owner: <strong>Priya Nair</strong>. Decision point at T+60 minutes.</p>`,
    type: "note",
    owner: "Priya Nair",
    updatedAt: new Date(now - 9 * H).toISOString(),
    createdAt: new Date(now - 12 * D).toISOString(),
    starred: false,
    shared: true,
    trashed: false,
    collaborators: [TEAM[2], TEAM[0]],
    tags: ["Launch"],
    wordCount: 540,
    readMinutes: 3,
    cover: "sand",
  },
  {
    id: "d4",
    title: "Board Deck — September Review",
    excerpt: "Monthly business review: ARR, NRR, activation funnels and hiring plan. 24 slides, appendix included.",
    content: `<h1>Board Deck — September Review</h1><p>Highlights: ARR up <strong>12% MoM</strong>, NRR at 118%, enterprise pipeline at an all-time high.</p><h2>Agenda</h2><ol><li>Metrics & funnel deep-dive</li><li>Product momentum</li><li>Hiring & burn</li></ol>`,
    type: "slides",
    owner: "Amara Osei",
    updatedAt: new Date(now - 1 * D).toISOString(),
    createdAt: new Date(now - 30 * D).toISOString(),
    starred: false,
    shared: true,
    trashed: false,
    collaborators: [TEAM[0], TEAM[4]],
    tags: ["Board", "Metrics"],
    wordCount: 320,
    readMinutes: 8,
    cover: "clay",
  },
  {
    id: "d5",
    title: "Pricing Model — Usage Scenarios",
    excerpt: "Scenario planning for seat + usage hybrid pricing. Break-even sheets and sensitivity tables.",
    content: `<h1>Pricing Model</h1><p>Hybrid <strong>seat + usage</strong> model wins on expansion. See tabs for sensitivity analysis.</p>`,
    type: "sheet",
    owner: "Diego Fuentes",
    updatedAt: new Date(now - 2 * D).toISOString(),
    createdAt: new Date(now - 50 * D).toISOString(),
    starred: true,
    shared: false,
    trashed: false,
    collaborators: [TEAM[3]],
    tags: ["Finance"],
    wordCount: 210,
    readMinutes: 5,
    cover: "cream",
  },
  {
    id: "d6",
    title: "Customer Research — Synthesis",
    excerpt: "14 interviews distilled into jobs, pains and opportunity tree. Sharing flow is the #1 friction point.",
    content: `<h1>Customer Research — Synthesis</h1><blockquote>“I just want to send a link and know it works. Permissions confuse me.”</blockquote><h2>Top findings</h2><ul><li>Share dialog needs one-click copy</li><li>People miss real-time cursors</li><li>Templates drive second-session return</li></ul>`,
    type: "doc",
    owner: "Sofia Marchetti",
    updatedAt: new Date(now - 3 * D).toISOString(),
    createdAt: new Date(now - 18 * D).toISOString(),
    starred: false,
    shared: true,
    trashed: false,
    collaborators: [TEAM[4], TEAM[0], TEAM[2]],
    tags: ["Research"],
    wordCount: 1980,
    readMinutes: 9,
    cover: null,
  },
  {
    id: "d7",
    title: "API Reference — Share Links v2",
    excerpt: "Endpoint contracts, permission enums and webhook payloads for the new share-link service.",
    content: `<h1>API Reference — Share Links v2</h1><p>Base URL: <code>https://api.docspace.io/v2</code></p><pre>POST /shares { resourceId, role, expiresAt }\nGET  /shares/:id\nPATCH /shares/:id { role }\nDELETE /shares/:id</pre><p>Roles: <code>viewer</code> | <code>commenter</code> | <code>editor</code>.</p>`,
    type: "pdf",
    owner: "Liam Carter",
    updatedAt: new Date(now - 4 * D).toISOString(),
    createdAt: new Date(now - 60 * D).toISOString(),
    starred: false,
    shared: false,
    trashed: false,
    collaborators: [TEAM[5]],
    tags: ["Engineering", "API"],
    wordCount: 730,
    readMinutes: 6,
    cover: null,
  },
  {
    id: "d8",
    title: "Brand Voice & Writing Guide",
    excerpt: "Tone principles, vocabulary and do/don't examples for product copy across DocSpace surfaces.",
    content: `<h1>Brand Voice & Writing Guide</h1><p>We are <strong>confident, warm, and precise</strong>. Short sentences. Active verbs. No jargon.</p><h2>Examples</h2><ul><li>Do: “Share with anyone in one click.”</li><li>Don't: “Leverage synergistic sharing paradigms.”</li></ul>`,
    type: "doc",
    owner: "Amara Osei",
    updatedAt: new Date(now - 6 * D).toISOString(),
    createdAt: new Date(now - 90 * D).toISOString(),
    starred: false,
    shared: true,
    trashed: false,
    collaborators: [TEAM[0], TEAM[1]],
    tags: ["Brand"],
    wordCount: 1120,
    readMinutes: 5,
    cover: "peach",
  },
  {
    id: "d9",
    title: "Sprint 42 — Retrospective",
    excerpt: "What went well, what didn't, and action items. Theme: finish the share-dialog polish.",
    content: `<h1>Sprint 42 — Retro</h1><h2>Went well</h2><ul><li>Shipped draft comments</li><li>Zero P1s in production</li></ul><h2>Action items</h2><ol><li>Stabilize flaky export test</li><li>Pair on presence performance</li></ol>`,
    type: "whiteboard",
    owner: "Jonas Weber",
    updatedAt: new Date(now - 8 * D).toISOString(),
    createdAt: new Date(now - 9 * D).toISOString(),
    starred: false,
    shared: true,
    trashed: false,
    collaborators: [TEAM[1], TEAM[2], TEAM[3], TEAM[5]],
    tags: ["Sprint"],
    wordCount: 380,
    readMinutes: 2,
    cover: null,
  },
  {
    id: "d10",
    title: "Old Draft — Homepage v1 Copy",
    excerpt: "Archived first-pass homepage copy. Kept for reference.",
    content: html("Archived copy. See Brand Voice guide for current direction."),
    type: "doc",
    owner: "Amara Osei",
    updatedAt: new Date(now - 30 * D).toISOString(),
    createdAt: new Date(now - 120 * D).toISOString(),
    starred: false,
    shared: false,
    trashed: true,
    collaborators: [TEAM[0]],
    tags: ["Archive"],
    wordCount: 150,
    readMinutes: 1,
    cover: null,
  },
  {
    id: "d11",
    title: "Security Review — SSO & Audit Logs",
    excerpt: "Threat model, control matrix and rollout plan for enterprise SSO with audit log streaming.",
    content: `<h1>Security Review — SSO & Audit Logs</h1><p>Scope: SAML + OIDC, SCIM provisioning, immutable audit trail.</p><h2>Controls</h2><ul><li>Enforce SSO for Business workspaces</li><li>Stream audit events to SIEM</li><li>7-year retention for Enterprise</li></ul>`,
    type: "pdf",
    owner: "Priya Nair",
    updatedAt: new Date(now - 10 * D).toISOString(),
    createdAt: new Date(now - 25 * D).toISOString(),
    starred: true,
    shared: true,
    trashed: false,
    collaborators: [TEAM[2], TEAM[5]],
    tags: ["Security"],
    wordCount: 940,
    readMinutes: 5,
    cover: "sand",
  },
  {
    id: "d12",
    title: "Meeting Notes — Design Crit 18",
    excerpt: "Feedback on the new editor toolbar density and share-dialog hierarchy. Decisions logged.",
    content: `<h1>Meeting Notes — Design Crit 18</h1><p>Decision: toolbar stays <strong>single-row</strong> with overflow menu. Share button remains primary orange.</p>`,
    type: "note",
    owner: "Sofia Marchetti",
    updatedAt: new Date(now - 12 * D).toISOString(),
    createdAt: new Date(now - 12 * D).toISOString(),
    starred: false,
    shared: false,
    trashed: false,
    collaborators: [TEAM[4]],
    tags: ["Meetings"],
    wordCount: 290,
    readMinutes: 2,
    cover: null,
  },
];

export const TEMPLATES = [
  {
    id: "t1",
    name: "Project Proposal",
    category: "Business",
    description: "Problem, approach, timeline and budget in a client-ready structure.",
    icon: "briefcase" as const,
  },
  {
    id: "t2",
    name: "Meeting Notes",
    category: "Productivity",
    description: "Agenda, decisions and action items with owners and due dates.",
    icon: "notebook" as const,
  },
  {
    id: "t3",
    name: "Product Spec (PRD)",
    category: "Product",
    description: "Context, goals, requirements and success metrics for any feature.",
    icon: "rocket" as const,
  },
  {
    id: "t4",
    name: "Weekly Report",
    category: "Business",
    description: "Wins, progress, risks and next steps — ready to share every Friday.",
    icon: "chart" as const,
  },
  {
    id: "t5",
    name: "Research Plan",
    category: "Research",
    description: "Objectives, methods, participants and synthesis framework.",
    icon: "search" as const,
  },
  {
    id: "t6",
    name: "Brand Brief",
    category: "Design",
    description: "Audience, voice, references and deliverables for creative work.",
    icon: "palette" as const,
  },
];

export function templateContent(name: string): string {
  return `<h1>${name}</h1><p>Start writing — this template gives you a premium structure. Replace each section with your own content.</p><h2>Overview</h2><p>Describe the goal, the audience, and what success looks like.</p><h2>Details</h2><ul><li>First key point</li><li>Second key point</li><li>Third key point</li></ul><h2>Next steps</h2><ol><li>Assign an owner</li><li>Set a due date</li><li>Share with stakeholders</li></ol><blockquote>Tip: press <code>/</code> in a full editor to insert blocks. In DocSpace, use the toolbar above.</blockquote>`;
}
