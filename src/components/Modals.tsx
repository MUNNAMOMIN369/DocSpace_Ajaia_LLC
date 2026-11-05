import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check, FileText, FileUp, Globe, Mail, Plus,
  Presentation, FileSpreadsheet, StickyNote, Upload, X, LayoutGrid, ChevronDown, ShieldCheck, Loader2,
} from "lucide-react";
import { useApp } from "../lib/app-context";
import { TEAM, type DocType } from "../lib/store";
import { Avatar, Dropdown, MenuItem, Spinner } from "./ui";
import { cn } from "../utils/cn";

/* ---------- Shell ---------- */
function ModalShell({ open, onClose, children, width = "max-w-lg", labelledBy }: {
  open: boolean; onClose: () => void; children: React.ReactNode; width?: string; labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#17243A]/45 backdrop-blur-[6px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn("glass-strong relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl sm:rounded-3xl", width)}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ModalHeader({ title, desc, onClose, id }: { title: string; desc?: string; onClose: () => void; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-6">
      <div>
        <h2 id={id} className="text-[18px] font-extrabold tracking-tight text-text-primary">{title}</h2>
        {desc && <p className="mt-1 text-[13.5px] text-text-secondary">{desc}</p>}
      </div>
      <button onClick={onClose} aria-label="Close" className="btn-ghost focus-ring rounded-xl p-2">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ---------- Create Document ---------- */
const CREATE_TYPES: { type: DocType; label: string; desc: string; icon: typeof FileText }[] = [
  { type: "doc", label: "Document", desc: "Rich text, headings & media", icon: FileText },
  { type: "note", label: "Quick note", desc: "Capture ideas instantly", icon: StickyNote },
  { type: "slides", label: "Presentation", desc: "A lightweight deck", icon: Presentation },
  { type: "sheet", label: "Spreadsheet", desc: "Tables & calculations", icon: FileSpreadsheet },
  { type: "whiteboard", label: "Whiteboard", desc: "Brainstorm visually", icon: LayoutGrid },
];

export function CreateModal() {
  const { createOpen, setCreateOpen, createDoc } = useApp();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("doc");

  const submit = () => {
    createDoc({ title: title.trim() || `Untitled ${CREATE_TYPES.find((t) => t.type === type)?.label.toLowerCase()}`, type });
    setTitle("");
    setCreateOpen(false);
  };

  return (
    <ModalShell open={createOpen} onClose={() => setCreateOpen(false)} labelledBy="create-title">
      <ModalHeader id="create-title" title="Create Document" desc="Choose a type and give it a name. You can change everything later." onClose={() => setCreateOpen(false)} />
      <div className="space-y-5 px-6 py-5">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-primary">Document title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Q4 Roadmap, Meeting notes…"
            className="input-premium focus-ring w-full rounded-xl px-3.5 py-2.5 text-[14px]"
          />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-text-primary">Document type</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CREATE_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                aria-pressed={type === t.type}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                  type === t.type
                    ? "border-orange-border bg-primary-light shadow-[0_4px_12px_rgba(249,115,22,0.12)] ring-1 ring-orange-border/50"
                    : "border-border bg-white hover:border-orange-border hover:bg-primary-light/50"
                )}
              >
                <span className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  type === t.type ? "bg-primary text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)]" : "bg-background text-text-secondary"
                )}>
                  <t.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[13.5px] font-bold", type === t.type ? "text-primary-active" : "text-text-primary")}>{t.label}</span>
                  <span className="block truncate text-[12px] text-text-secondary">{t.desc}</span>
                </span>
                {type === t.type && (
                  <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => setCreateOpen(false)} className="btn-secondary focus-ring rounded-xl px-4 py-2.5 text-[13.5px] font-semibold">Cancel</button>
          <button onClick={submit} className="btn-primary focus-ring flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold">
            <Plus className="h-4 w-4" strokeWidth={2.75} /> Create Document
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Upload ---------- */
export function UploadModal() {
  const { uploadOpen, setUploadOpen, importFiles } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (uploading) return;
    setUploadOpen(false);
    setStaged([]);
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = [...files].slice(0, 10);
    if (arr.length === 0) return;
    setStaged((s) => [...s, ...arr].slice(0, 10));
  };

  const startUpload = async () => {
    if (staged.length === 0) return;
    setUploading(true);
    try {
      await importFiles(staged);
      setUploading(false);
      setUploadOpen(false);
      setStaged([]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell open={uploadOpen} onClose={close} labelledBy="upload-title">
      <ModalHeader id="upload-title" title="Import Files" desc="Import plain text or Markdown documents." onClose={close} />
      <div className="space-y-4 px-6 py-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          aria-label="Upload files"
          className={cn("dropzone focus-ring flex cursor-pointer flex-col items-center justify-center rounded-2xl px-6 py-10 text-center", dragOver && "drag-over")}
        >
          <input ref={inputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200",
            dragOver ? "scale-110 bg-primary text-white shadow-[0_8px_24px_rgba(249,115,22,0.4)]" : "bg-primary-light text-primary-hover ring-1 ring-orange-border/40"
          )}>
            {dragOver ? <FileUp className="h-7 w-7" /> : <Upload className="h-6 w-6" />}
          </div>
          <p className="mt-4 text-[15px] font-bold text-text-primary">
            {dragOver ? "Drop files to import" : "Drag & drop files here"}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            or <span className="font-bold text-primary-hover underline underline-offset-2">browse from your computer</span>
          </p>
          <p className="mt-2 text-[12px] text-text-muted">TXT and Markdown · Max 500 KB per file · Up to 10 files</p>
        </div>

        {staged.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-bold text-text-primary">{staged.length} file{staged.length > 1 ? "s" : ""} ready</p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto">
              {staged.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary-hover">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-text-primary">{f.name}</p>
                    <p className="text-[12px] text-text-muted">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                  {!uploading && (
                    <button onClick={(e) => { e.stopPropagation(); setStaged((s) => s.filter((_, j) => j !== i)); }}
                      className="btn-ghost focus-ring rounded-lg p-1.5" aria-label={`Remove ${f.name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {uploading && <Check className="h-4 w-4 text-success" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-text-primary"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Saving imported documents…</p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={close} disabled={uploading} className="btn-secondary focus-ring rounded-xl px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">Cancel</button>
          <button
            onClick={startUpload}
            disabled={staged.length === 0 || uploading}
            className="btn-primary focus-ring flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold"
          >
            {uploading ? <><Spinner size={16} /> Importing…</> : <><Upload className="h-4 w-4" /> Import {staged.length > 0 ? `${staged.length} file${staged.length > 1 ? "s" : ""}` : ""}</>}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Share ---------- */
const ROLES = [
  { key: "viewer", label: "Viewer", desc: "Can view only", icon: Globe },
  { key: "editor", label: "Editor", desc: "Can view and edit", icon: ShieldCheck },
] as const;

export function ShareDialog() {
  const { shareDocId, setShareDocId, docs, user, refreshCollaborators, shareWithUser, changeCollaboratorRole, removeCollaborator, pushToast } = useApp();
  const doc = docs.find((d) => d.id === shareDocId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [working, setWorking] = useState(false);
  const isOwner = doc?.collaborators.some((collaborator) => collaborator.role === "owner" && collaborator.email === user.email) ?? false;

  useEffect(() => {
    if (!doc) return;
    void refreshCollaborators(doc.id).catch((error) => {
      pushToast({ title: "Could not load sharing settings", description: error instanceof Error ? error.message : "Please try again.", kind: "error" });
    });
  }, [doc?.id, refreshCollaborators, pushToast]);

  const close = () => { setShareDocId(null); setEmail(""); };

  const invite = async () => {
    if (!doc || !email.trim() || !email.includes("@")) {
      pushToast({ title: "Enter a valid email", kind: "warning" });
      return;
    }
    setWorking(true);
    try {
      await shareWithUser(doc.id, email.trim(), role);
      setEmail("");
      pushToast({ title: "Collaborator access updated", description: `${email.trim()} can ${role === "editor" ? "edit" : "view"} this document.`, kind: "success" });
    } catch (error) {
      pushToast({ title: "Could not share document", description: error instanceof Error ? error.message : "Please try again.", kind: "error" });
    } finally {
      setWorking(false);
    }
  };

  const changeRole = async (id: string, r: "editor" | "viewer") => {
    if (!doc) return;
    setWorking(true);
    try {
      await changeCollaboratorRole(doc.id, id, r);
      pushToast({ title: "Access updated", description: `Collaborator is now a ${r}.`, kind: "success" });
    } catch (error) {
      pushToast({ title: "Could not update access", description: error instanceof Error ? error.message : "Please try again.", kind: "error" });
    } finally {
      setWorking(false);
    }
  };

  const remove = async (id: string) => {
    if (!doc) return;
    setWorking(true);
    try {
      await removeCollaborator(doc.id, id);
      pushToast({ title: "Access removed", kind: "info" });
    } catch (error) {
      pushToast({ title: "Could not remove access", description: error instanceof Error ? error.message : "Please try again.", kind: "error" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ModalShell open={!!doc} onClose={close} labelledBy="share-title">
      {doc && (
        <>
          <ModalHeader id="share-title" title={`Share “${doc.title.length > 34 ? doc.title.slice(0, 34) + "…" : doc.title}”`} desc="Share with registered users and choose their access level." onClose={close} />
          <div className="space-y-5 px-6 py-5">
            {/* Invite row */}
            {isOwner && <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                  placeholder="Invite by email — name@company.com"
                  className="input-premium focus-ring w-full rounded-xl py-2.5 pl-10 pr-3.5 text-[14px]"
                />
              </div>
              <div className="flex gap-2">
                <Dropdown
                  trigger={
                    <button className="input-premium focus-ring flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold capitalize">
                      {role} <ChevronDown className="h-4 w-4 text-text-muted" />
                    </button>
                  }
                  width="w-56"
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r.key} label={r.label} hint={r.desc} onClick={() => setRole(r.key)} />
                  ))}
                </Dropdown>
                <button onClick={() => void invite()} disabled={working} className="btn-primary focus-ring rounded-xl px-4 py-2.5 text-[13.5px] font-bold disabled:opacity-50">Invite</button>
              </div>
            </div>}
            {!isOwner && <p className="rounded-xl bg-background p-3 text-[12.5px] text-text-secondary ring-1 ring-border">Only the document owner can manage collaborator access.</p>}

            {/* People */}
            <div>
              <p className="mb-2 text-[13px] font-bold text-text-primary">People with access ({doc.collaborators.length})</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {doc.collaborators.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-primary-light/60">
                    <Avatar name={c.name} color={c.avatarColor} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-text-primary">{c.name}</p>
                      <p className="truncate text-[12px] text-text-secondary">{c.email}</p>
                    </div>
                    {c.role === "owner" ? (
                      <span className="rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-text-secondary ring-1 ring-border">Owner</span>
                    ) : isOwner ? (
                      <Dropdown
                        trigger={
                          <button className="focus-ring flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold capitalize text-text-secondary hover:bg-white hover:text-primary-active hover:ring-1 hover:ring-orange-border/50">
                            {c.role} <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        }
                        width="w-44"
                      >
                        {(["viewer", "editor"] as const).map((r) => (
                          <MenuItem key={r} label={r[0].toUpperCase() + r.slice(1)} onClick={() => void changeRole(c.id, r)} />
                        ))}
                        <MenuItem label="Remove access" danger onClick={() => void remove(c.id)} />
                      </Dropdown>
                    ) : (
                      <span className="rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold capitalize text-text-secondary ring-1 ring-border">{c.role}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-background p-3 ring-1 ring-border">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              <p className="text-[12.5px] text-text-secondary">Only listed collaborators can access this document. Owners manage access; editors can edit and viewers can only read.</p>
            </div>

            <div className="flex justify-end">
              <button onClick={close} className="btn-primary focus-ring rounded-xl px-6 py-2.5 text-[13.5px] font-bold">Done</button>
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* ---------- Upgrade ---------- */
export function UpgradeModal() {
  const { upgradeOpen, setUpgradeOpen } = useApp();
  return (
    <ModalShell open={upgradeOpen} onClose={() => setUpgradeOpen(false)} width="max-w-lg" labelledBy="upgrade-title">
      <ModalHeader id="upgrade-title" title="Plans & billing" desc="Subscription management is not configured in this build." onClose={() => setUpgradeOpen(false)} />
      <div className="space-y-4 px-6 py-6">
        <p className="text-[13.5px] leading-relaxed text-text-secondary">
          No paid plans, billing provider, or subscription changes are available here. Document creation, imports, and collaborator permissions remain available.
        </p>
        <div className="flex justify-end">
          <button onClick={() => setUpgradeOpen(false)} className="btn-primary focus-ring rounded-xl px-5 py-2.5 text-[13px] font-bold">Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Suggested teammates (for share discoverability) ---------- */
export function suggestedTeammates(exclude: string[]) {
  return TEAM.filter((t) => !exclude.includes(t.id)).slice(0, 3);
}
