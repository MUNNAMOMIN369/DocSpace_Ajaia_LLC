import { Bell, ChevronDown, ChevronsUpDown, Command, CreditCard, LogOut, Menu, Plus, Search, Settings, Upload, User } from "lucide-react";
import { useApp } from "../lib/app-context";
import { Avatar, Dropdown, MenuDivider, MenuItem, MenuLabel } from "./ui";

export default function TopBar() {
  const { user, search, setSearch, setSidebarOpen, setCreateOpen, setUploadOpen, setUpgradeOpen, logout, setView, pushToast, docs } = useApp();

  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <div className="flex h-[68px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          onClick={() => setSidebarOpen(true)}
          className="btn-ghost focus-ring rounded-xl p-2 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents, tags, owners…"
            className="input-premium focus-ring w-full rounded-xl py-2.5 pl-10 pr-16 text-[13.5px]"
            aria-label="Search documents"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md bg-background px-1.5 py-1 text-[11px] font-semibold text-text-muted ring-1 ring-border sm:flex">
            <Command className="h-3 w-3" /> K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="btn-ghost focus-ring hidden items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold md:flex"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary focus-ring flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* Notifications */}
          <Dropdown
            trigger={
              <button className="btn-ghost focus-ring relative rounded-xl p-2.5" aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </button>
            }
            width="w-[340px]"
          >
            <div className="px-3 pb-3 pt-2">
              <p className="text-[13px] font-bold text-text-primary">Notifications</p>
              <p className="mt-2 text-[12.5px] text-text-muted">Activity notifications are not configured in this build.</p>
            </div>
          </Dropdown>

          {/* Profile */}
          <Dropdown
            trigger={
              <button className="focus-ring flex items-center gap-2 rounded-xl p-1.5 pr-2 transition-colors hover:bg-primary-light" aria-label="Profile menu">
                <Avatar name={user.name} color="bg-orange-500" size="sm" />
                <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
              </button>
            }
            width="w-64"
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={user.name} color="bg-orange-500" size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-text-primary">{user.name}</p>
                <p className="truncate text-[12px] text-text-secondary">{user.email}</p>
                {user.plan && <span className="mt-1 inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary-active ring-1 ring-orange-border/40">{user.plan} plan</span>}
              </div>
            </div>
            <MenuDivider />
            <MenuLabel>Workspace</MenuLabel>
            <MenuItem icon={<ChevronsUpDown className="h-4 w-4" />} label="Personal workspace" hint="Current" onClick={() => pushToast({ title: "Workspace switching unavailable", description: "Multi-workspace support is not configured.", kind: "info" })} />
            <MenuItem icon={<User className="h-4 w-4" />} label="Profile & account" onClick={() => setView("settings")} />
            <MenuItem icon={<CreditCard className="h-4 w-4" />} label="Billing & plans" onClick={() => setUpgradeOpen(true)} />
            <MenuItem icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => setView("settings")} />
            <MenuDivider />
            <MenuItem icon={<LogOut className="h-4 w-4" />} label="Sign out" danger onClick={logout} />
            <div className="px-3 py-2">
              <p className="text-[11.5px] text-text-muted">{docs.filter((d) => !d.trashed).length} documents</p>
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
