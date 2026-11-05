import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileText, FileSpreadsheet,
  FileImage, FilePlus2, Info, Presentation, StickyNote, X, XCircle, LayoutGrid,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { DocType } from "../lib/store";
import { initials } from "../lib/store";

/* ---------- Logo ---------- */
export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-[10px] shadow-[0_4px_12px_rgba(249,115,22,0.35)] ring-1 ring-black/5">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M7 3.5h7l4.5 4.5V20a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" fill="white" opacity="0.96" />
          <path d="M14 3.5V8h4.5" fill="#FDBA74" />
          <path d="M9.5 12.5h5M9.5 15.5h5M9.5 18h3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <p className={cn("text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-text-primary")}>
            DocSpace
          </p>
          <p className={cn("mt-0.5 text-[11px] font-medium tracking-wide", light ? "text-orange-100" : "text-text-muted")}>
            WORKSPACE
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, color, size = "md", ring = false }: { name: string; color: string; size?: "xs" | "sm" | "md" | "lg"; ring?: boolean }) {
  const sizes = { xs: "h-6 w-6 text-[9px]", sm: "h-7 w-7 text-[10px]", md: "h-8 w-8 text-[11px]", lg: "h-10 w-10 text-[13px]" };
  return (
    <div
      title={name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        color,
        sizes[size],
        ring && "ring-2 ring-white shadow-sm"
      )}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarStack({ items, max = 4 }: { items: { name: string; avatarColor: string }[]; max?: number }) {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((c, i) => (
        <Avatar key={i} name={c.name} color={c.avatarColor} size="sm" ring />
      ))}
      {extra > 0 && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary-active ring-2 ring-white">
          +{extra}
        </div>
      )}
    </div>
  );
}

/* ---------- Doc type icon ---------- */
export function DocTypeIcon({ type, className }: { type: DocType; className?: string }) {
  const cls = cn("h-[18px] w-[18px]", className);
  switch (type) {
    case "sheet": return <FileSpreadsheet className={cls} />;
    case "slides": return <Presentation className={cls} />;
    case "pdf": return <FileImage className={cls} />;
    case "note": return <StickyNote className={cls} />;
    case "whiteboard": return <LayoutGrid className={cls} />;
    default: return <FileText className={cls} />;
  }
}

export function DocIconBadge({ type, cover }: { type: DocType; cover?: string | null }) {
  const coverCls =
    cover === "orange" ? "bg-brand-gradient text-white border-transparent"
    : cover === "peach" ? "bg-primary-soft text-primary-active border-orange-border/50"
    : cover === "sand" ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]"
    : cover === "clay" ? "bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74]/60"
    : cover === "cream" ? "bg-[#FFF7ED] text-primary-hover border-orange-border/40"
    : "bg-white text-primary-hover border-border";
  return (
    <div className={cn("doc-icon flex h-11 w-11 items-center justify-center rounded-xl border", coverCls)}>
      <DocTypeIcon type={type} />
    </div>
  );
}

/* ---------- Dropdown ---------- */
export function Dropdown({
  trigger, children, align = "right", width = "w-56",
}: { trigger: ReactNode; children: ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass absolute z-50 mt-2 overflow-hidden rounded-xl p-1.5",
              width,
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  icon, label, hint, danger, onClick,
}: { icon?: ReactNode; label: string; hint?: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "menu-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-text-primary",
        danger && "danger text-text-primary"
      )}
    >
      {icon && <span className="text-text-secondary">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{children}</p>;
}

export function MenuDivider() {
  return <div className="mx-2 my-1.5 h-px bg-border" />;
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary-hover ring-1 ring-orange-border/40">
        {icon ?? <FilePlus2 className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-[16px] font-bold tracking-tight text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-text-secondary">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({
  page, totalPages, onChange, totalItems, pageSize,
}: { page: number; totalPages: number; onChange: (p: number) => void; totalItems: number; pageSize: number }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const nums = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );
  const withGaps: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) withGaps.push("…");
    withGaps.push(n);
  });
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-[12.5px] text-text-secondary">
        Showing <span className="font-semibold text-text-primary">{start}–{end}</span> of{" "}
        <span className="font-semibold text-text-primary">{totalItems}</span> documents
      </p>
      <div className="flex items-center gap-1.5">
        <button disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"
          className="page-btn focus-ring flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {withGaps.map((n, i) =>
          n === "…" ? (
            <span key={`g${i}`} className="px-1 text-text-muted">…</span>
          ) : (
            <button key={n} onClick={() => onChange(n)}
              className={cn("page-btn focus-ring h-9 min-w-9 rounded-lg px-2.5 text-[13.5px]", n === page && "active")}>
              {n}
            </button>
          )
        )}
        <button disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Next page"
          className="page-btn focus-ring flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Loading ---------- */
export function Spinner({ size = 18 }: { size?: number }) {
  return <div className="spinner-orange rounded-full" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="skeleton h-11 w-11 rounded-xl" />
        <div className="skeleton h-6 w-6 rounded-lg" />
      </div>
      <div className="skeleton mt-4 h-4 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-full rounded" />
      <div className="skeleton mt-1 h-3 w-2/3 rounded" />
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-3 w-14 rounded" />
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
export function ToastIcon({ kind }: { kind: "success" | "info" | "warning" | "error" }) {
  if (kind === "success") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (kind === "warning") return <AlertTriangle className="h-5 w-5 text-warning" />;
  if (kind === "error") return <XCircle className="h-5 w-5 text-error" />;
  return <Info className="h-5 w-5 text-primary" />;
}

export function ToastClose({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Dismiss"
      className="btn-ghost focus-ring rounded-lg p-1">
      <X className="h-4 w-4" />
    </button>
  );
}
