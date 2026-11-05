import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown, Briefcase, Check, ChevronDown, FileText, FilePlus2, FolderOpen, Inbox,
  LayoutGrid, List, NotebookPen, Palette, Plus, Rocket, SearchX, LineChart,
  SlidersHorizontal, Star, Trash2, Upload, Users,
} from "lucide-react";
import { useApp } from "../lib/app-context";
import { TEMPLATES, templateContent, timeAgo, type DocType, type ViewKey } from "../lib/store";
import DocumentCard from "./DocumentCard";
import { Avatar, Dropdown, EmptyState, MenuItem, Pagination } from "./ui";
import { cn } from "../utils/cn";

const PAGE_SIZE = 8;

const VIEW_META: Record<ViewKey, { title: string; desc: string; icon: typeof Inbox }> = {
  home: { title: "Home", desc: "Everything you need, right where you left it.", icon: FolderOpen },
  recent: { title: "Recent", desc: "Your most recently updated documents.", icon: Inbox },
  starred: { title: "Starred", desc: "Items starred for the current session.", icon: Star },
  shared: { title: "Shared with me", desc: "Documents your team shared with you.", icon: Users },
  templates: { title: "Templates", desc: "Start faster with premium structures.", icon: LayoutGrid },
  trash: { title: "Trash", desc: "Deleted documents cannot be recovered in this build.", icon: Trash2 },
  settings: { title: "Settings", desc: "Account information and available settings.", icon: SlidersHorizontal },
};

const TYPE_FILTERS: { key: DocType | "all"; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "doc", label: "Documents" },
  { key: "note", label: "Notes" },
  { key: "slides", label: "Decks" },
  { key: "sheet", label: "Sheets" },
  { key: "pdf", label: "PDFs" },
  { key: "whiteboard", label: "Boards" },
];

function TemplateIcon({ icon }: { icon: string }) {
  const cls = "h-5 w-5";
  if (icon === "briefcase") return <Briefcase className={cls} />;
  if (icon === "notebook") return <NotebookPen className={cls} />;
  if (icon === "rocket") return <Rocket className={cls} />;
  if (icon === "chart") return <LineChart className={cls} />;
  if (icon === "palette") return <Palette className={cls} />;
  return <FileText className={cls} />;
}

export default function Dashboard() {
  const {
    view, docs, search, sort, setSort, typeFilter, setTypeFilter, tagFilter, setTagFilter,
    setUploadOpen, setCreateOpen, openDoc, toggleStar, deleteDoc,
  } = useApp();
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<"grid" | "list">("grid");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    docs.forEach((d) => d.tags.forEach((t) => s.add(t)));
    return [...s].slice(0, 8);
  }, [docs]);

  const filtered = useMemo(() => {
    let list = [...docs];
    if (view === "home" || view === "recent") list = list.filter((d) => !d.trashed);
    if (view === "starred") list = list.filter((d) => d.starred && !d.trashed);
    if (view === "shared") list = list.filter((d) => d.sharedWithMe && !d.trashed);
    if (view === "trash") list = list.filter((d) => d.trashed);
    if (typeFilter !== "all") list = list.filter((d) => d.type === typeFilter);
    if (tagFilter) list = list.filter((d) => d.tags.includes(tagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) => d.title.toLowerCase().includes(q) || d.excerpt.toLowerCase().includes(q) ||
          d.owner.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "created") return +new Date(b.createdAt) - +new Date(a.createdAt);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
    return list;
  }, [docs, view, typeFilter, tagFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // reset page when filters change
  const [lastKey, setLastKey] = useState("");
  const key = `${view}-${typeFilter}-${tagFilter}-${search}-${sort}`;
  if (key !== lastKey) { setLastKey(key); if (page !== 1) setPage(1); }

  const meta = VIEW_META[view];
  const recentDocs = docs.filter((d) => !d.trashed).slice(0, 3);

  if (view === "templates") return <TemplatesView />;
  if (view === "settings") return <SettingsView />;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary-hover ring-1 ring-orange-border/40">
              <meta.icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary sm:text-[26px]">{meta.title}</h1>
              <p className="text-[13.5px] text-text-secondary">{meta.desc}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setUploadOpen(true)} className="btn-secondary focus-ring flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold">
            <Upload className="h-4 w-4" /> Import File
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-primary focus-ring flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold">
            <Plus className="h-4 w-4" strokeWidth={2.75} /> Create Document
          </button>
        </div>
      </div>

      {/* Spotlight strip (home only) */}
      {view === "home" && !search && (
        <div className="relative mt-6 overflow-hidden rounded-2xl bg-brand-gradient p-6 sm:p-7">
          <div className="dot-grid absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1.2px, transparent 1.2px)" }} />
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-orange-100">Continue where you left off</p>
              <h2 className="mt-1.5 font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]">
                Your workspace is calm, organized and ready to ship.
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => recentDocs[0] && openDoc(recentDocs[0].id)} className="rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-bold text-primary-active shadow-lg transition-all duration-200 hover:bg-orange-50 hover:shadow-xl active:scale-[0.98]">
                  Resume editing →
                </button>
                <button onClick={() => setUploadOpen(true)} className="rounded-xl bg-white/15 px-4 py-2.5 text-[13.5px] font-bold text-white ring-1 ring-white/30 backdrop-blur transition-all duration-200 hover:bg-white/25">
                  Import files
                </button>
              </div>
            </div>
            <div className="grid w-full max-w-sm grid-cols-3 gap-2.5">
              {[
                { n: docs.filter((d) => !d.trashed).length.toString(), l: "Documents" },
                { n: docs.filter((d) => d.shared && !d.trashed).length.toString(), l: "Shared" },
                { n: docs.filter((d) => d.starred && !d.trashed).length.toString(), l: "Starred" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/10 p-3 text-center ring-1 ring-white/25 backdrop-blur-md">
                  <p className="text-[22px] font-extrabold text-white">{s.n}</p>
                  <p className="text-[11.5px] font-semibold text-orange-50">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="sticky top-[68px] z-20 -mx-4 mt-6 border-y border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={cn(
                  "focus-ring rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200",
                  typeFilter === t.key
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(249,115,22,0.32)]"
                    : "bg-white text-text-secondary ring-1 ring-border hover:border-orange-border hover:bg-primary-light hover:text-primary-active"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {allTags.length > 0 && (
              <Dropdown
                trigger={
                  <button className={cn("focus-ring flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12.5px] font-semibold ring-1 transition-all",
                    tagFilter ? "border-orange-border bg-primary-light text-primary-active ring-orange-border/50" : "text-text-secondary ring-border hover:bg-primary-light")}>
                    #{tagFilter ?? "Tags"} <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                }
                width="w-48"
              >
                <MenuItem label="All tags" onClick={() => setTagFilter(null)} />
                {allTags.map((t) => (
                  <MenuItem key={t} label={`#${t}`} icon={tagFilter === t ? <Check className="h-4 w-4 text-primary" /> : undefined} onClick={() => setTagFilter(t)} />
                ))}
              </Dropdown>
            )}
            <Dropdown
              trigger={
                <button className="focus-ring flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12.5px] font-semibold text-text-secondary ring-1 ring-border hover:bg-primary-light">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sort === "updated" ? "Last edited" : sort === "name" ? "Name" : "Created"} <ChevronDown className="h-3.5 w-3.5" />
                </button>
              }
              width="w-44"
            >
              <MenuItem label="Last edited" onClick={() => setSort("updated")} />
              <MenuItem label="Name (A–Z)" onClick={() => setSort("name")} />
              <MenuItem label="Recently created" onClick={() => setSort("created")} />
            </Dropdown>
            <div className="hidden items-center rounded-xl bg-white p-1 ring-1 ring-border sm:flex">
              {([["grid", LayoutGrid], ["list", List]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setDensity(k)} aria-label={`${k} view`}
                  className={cn("rounded-lg p-1.5 transition-all duration-200", density === k ? "bg-primary-light text-primary-active shadow-sm ring-1 ring-orange-border/40" : "text-text-muted hover:text-text-primary")}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={search ? <SearchX className="h-6 w-6" /> : view === "starred" ? <Star className="h-6 w-6" /> : view === "trash" ? <Trash2 className="h-6 w-6" /> : <FilePlus2 className="h-6 w-6" />}
            title={search ? `No results for “${search}”` : view === "starred" ? "No starred documents yet" : view === "trash" ? "Trash recovery is unavailable" : view === "shared" ? "Nothing shared with you yet" : "No documents yet"}
            description={search ? "Try a different keyword, or clear filters to browse everything." : view === "trash" ? "Documents are permanently deleted in this build." : view === "shared" ? "Documents shared with this account will appear here." : view === "starred" ? "Starred status is only stored for this session." : "Create your first document or import existing files to get started in seconds."}
            action={
              view === "trash" ? undefined :
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => setCreateOpen(true)} className="btn-primary focus-ring flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold">
                  <Plus className="h-4 w-4" /> Create Document
                </button>
                <button onClick={() => setUploadOpen(true)} className="btn-secondary focus-ring flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold">
                  <Upload className="h-4 w-4" /> Import File
                </button>
              </div>
            }
          />
        ) : density === "grid" ? (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {pageItems.map((doc, i) => (
                <motion.div key={doc.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.24, delay: Math.min(i * 0.03, 0.2) }}>
                  <DocumentCard doc={doc} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(23,36,58,0.05)]">
            <div className="hidden grid-cols-[1fr_140px_170px_110px] gap-4 border-b border-border bg-background/60 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-text-muted sm:grid">
              <span>Name</span><span>Owner</span><span>Last edited</span><span className="text-right">Actions</span>
            </div>
            {pageItems.map((doc) => (
              <div key={doc.id} onClick={() => openDoc(doc.id)}
                className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-5 py-3 transition-colors duration-200 last:border-0 hover:bg-primary-light/60 sm:grid-cols-[1fr_140px_170px_110px] sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-hover ring-1 ring-orange-border/30">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-text-primary">{doc.title}</p>
                    <p className="truncate text-[12px] text-text-secondary">{doc.excerpt}</p>
                  </div>
                </div>
                <p className="hidden text-[13px] text-text-secondary sm:block">{doc.owner}</p>
                <p className="hidden text-[13px] text-text-secondary sm:block">{timeAgo(doc.updatedAt)}</p>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleStar(doc.id)} className="rounded-lg p-2 text-text-muted hover:bg-primary-light hover:text-primary" aria-label="Star">
                    <Star className={cn("h-4 w-4", doc.starred && "fill-primary text-primary")} />
                  </button>
                  <button onClick={() => { if (window.confirm("Delete this document permanently? This cannot be undone.")) void deleteDoc(doc.id); }} className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-error" aria-label="Delete permanently">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-white px-4 py-3.5">
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Templates ---------------- */
function TemplatesView() {
  const { createDoc, pushToast } = useApp();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary-hover ring-1 ring-orange-border/40">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary sm:text-[26px]">Templates</h1>
          <p className="text-[13.5px] text-text-secondary">Start faster with premium, pre-structured documents.</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t, i) => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            onClick={() => createDoc({ title: t.name, content: templateContent(t.name), templateName: t.category })}
            className="doc-card focus-ring group rounded-2xl p-5 text-left"
          >
            <div className="doc-icon flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-primary-hover">
              <TemplateIcon icon={t.icon} />
            </div>
            <p className="mt-3 inline-block rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary-active ring-1 ring-orange-border/40">{t.category}</p>
            <h3 className="mt-2 text-[15.5px] font-bold tracking-tight text-text-primary">{t.name}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{t.description}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-hover opacity-0 transition-all duration-200 group-hover:opacity-100">
              Use template <span aria-hidden>→</span>
            </span>
          </motion.button>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-gradient p-5">
        <div>
          <p className="text-[15px] font-bold text-white">Custom team templates</p>
          <p className="text-[13px] text-orange-100">Custom template publishing is not configured in this build.</p>
        </div>
        <button onClick={() => pushToast({ title: "Custom templates unavailable", description: "This build includes only the built-in templates.", kind: "info" })}
          className="rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-bold text-primary-active transition-all hover:bg-orange-50">
          Details
        </button>
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsView() {
  const { user, setUpgradeOpen } = useApp();
  const preferences = [
    { title: "Document autosave", desc: "Changes are saved to the server after editing.", status: "Active" },
    { title: "Activity notifications", desc: "Comments and activity alerts are not configured.", status: "Unavailable" },
    { title: "Live presence", desc: "Real-time collaborator presence is not configured.", status: "Unavailable" },
    { title: "Public links", desc: "Only owner-managed access for registered users is supported.", status: "Unavailable" },
  ];

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary-hover ring-1 ring-orange-border/40">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary sm:text-[26px]">Settings</h1>
          <p className="text-[13.5px] text-text-secondary">Account information and available application settings.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,36,58,0.05)]">
          <h2 className="text-[15px] font-bold text-text-primary">Profile</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={user.name} color="bg-orange-500" size="lg" />
            <div>
              <p className="text-[14px] font-bold text-text-primary">{user.name}</p>
              <p className="text-[13px] text-text-secondary">{user.email}</p>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-text-muted">Profile updates and avatar uploads are not available in this build.</p>
        </section>

        <section className="rounded-2xl border border-border bg-white px-6 py-2 shadow-[0_1px_2px_rgba(23,36,58,0.05)]">
          <h2 className="pt-4 text-[15px] font-bold text-text-primary">Feature availability</h2>
          <div className="divide-y divide-border">
            {preferences.map((preference) => (
              <div key={preference.title} className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-[14px] font-bold text-text-primary">{preference.title}</p>
                  <p className="text-[13px] text-text-secondary">{preference.desc}</p>
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-bold text-text-secondary ring-1 ring-border">{preference.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-orange-border/50 bg-primary-light">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-primary-active ring-1 ring-orange-border/50">
                <SlidersHorizontal className="h-3 w-3" /> BILLING
              </p>
              <h2 className="mt-2 text-[17px] font-extrabold text-text-primary">Subscription management is unavailable</h2>
              <p className="mt-0.5 text-[13.5px] text-text-secondary">No billing provider or paid plans are configured.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUpgradeOpen(true)} className="btn-secondary focus-ring rounded-xl px-4 py-2.5 text-[13.5px] font-semibold">Details</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
