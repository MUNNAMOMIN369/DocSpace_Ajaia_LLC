import { Clock3, Crown, FileText, Home, Plus, Settings, Star, Trash2, Upload, Users, LayoutTemplate } from "lucide-react";
import { useApp } from "../lib/app-context";
import { Logo } from "./ui";
import { cn } from "../utils/cn";

const NAV = [
  { key: "home" as const, label: "Home", icon: Home },
  { key: "recent" as const, label: "Recent", icon: Clock3 },
  { key: "starred" as const, label: "Starred", icon: Star },
  { key: "shared" as const, label: "Shared with me", icon: Users },
  { key: "templates" as const, label: "Templates", icon: LayoutTemplate },
  { key: "trash" as const, label: "Trash", icon: Trash2 },
];

export default function Sidebar() {
  const { view, setView, docs, setUploadOpen, setCreateOpen, setUpgradeOpen, sidebarOpen, setSidebarOpen } = useApp();

  const counts: Record<string, number> = {
    home: docs.filter((d) => !d.trashed).length,
    recent: docs.filter((d) => !d.trashed).length,
    starred: docs.filter((d) => d.starred && !d.trashed).length,
    shared: docs.filter((d) => d.sharedWithMe && !d.trashed).length,
    trash: docs.filter((d) => d.trashed).length,
  };

  const panel = (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <Logo />
      </div>

      <div className="space-y-2 px-3 pt-4">
        <button
          onClick={() => { setCreateOpen(true); setSidebarOpen(false); }}
          className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          Create Document
        </button>
        <button
          onClick={() => { setUploadOpen(true); setSidebarOpen(false); }}
          className="btn-secondary focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold"
        >
          <Upload className="h-4 w-4" />
          Import File
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Primary">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">Workspace</p>
        {NAV.slice(0, 5).map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            aria-current={view === item.key ? "page" : undefined}
            className={cn("nav-item focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium", view === item.key && "active")}
          >
            <item.icon className="nav-icon h-[18px] w-[18px] transition-colors" />
            <span className="flex-1 text-left">{item.label}</span>
            {counts[item.key] !== undefined && (
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                view === item.key ? "bg-primary-soft text-primary-active" : "bg-background text-text-muted"
              )}>
                {counts[item.key]}
              </span>
            )}
            {view === item.key && <span className="absolute" />}
          </button>
        ))}

        <p className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">System</p>
        {NAV.slice(5).map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cn("nav-item focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium", view === item.key && "active")}
          >
            <item.icon className="nav-icon h-[18px] w-[18px]" />
            <span className="flex-1 text-left">{item.label}</span>
            {counts[item.key] > 0 && (
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-muted">{counts[item.key]}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => setView("settings")}
          className={cn("nav-item focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium", view === "settings" && "active")}
        >
          <Settings className="nav-icon h-[18px] w-[18px]" />
          <span className="flex-1 text-left">Settings</span>
        </button>
      </nav>

      <div className="space-y-3 p-3">
        <div className="rounded-2xl border border-border bg-background p-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary-hover" />
            <p className="text-[12.5px] font-bold text-text-primary">Storage</p>
            <span className="ml-auto text-[11.5px] font-semibold text-text-secondary">Not tracked</span>
          </div>
          <p className="mt-2 text-[11.5px] text-text-muted">Storage usage is not available in this build.</p>
        </div>
        <button
          onClick={() => setUpgradeOpen(true)}
          className="focus-ring group relative w-full overflow-hidden rounded-2xl bg-brand-gradient p-[1.5px] text-left"
        >
          <div className="rounded-[14px] bg-white/[0.08] p-3.5 backdrop-blur-sm transition-colors duration-200 group-hover:bg-white/[0.14]">
            <div className="flex items-center gap-2 text-white">
              <Crown className="h-4 w-4" />
              <p className="text-[13px] font-bold">Plans & billing</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-orange-50/90">Subscription management is not configured.</p>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 border-r border-border lg:block">
        {panel}
      </aside>
      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setSidebarOpen(false)}
          className={`absolute inset-0 bg-[#17243A]/40 backdrop-blur-sm transition-opacity duration-200 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div className={`absolute left-0 top-0 h-full w-[300px] max-w-[85vw] shadow-2xl transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {panel}
        </div>
      </div>
    </>
  );
}
