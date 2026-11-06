import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CURRENT_USER, uid, type Collaborator, type DocItem, type DocType, type Toast, type ViewKey } from "./store";

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
  : "";

type SaveStatus = "saving" | "saved" | "error";
type AppUser = typeof CURRENT_USER & { id?: string };

interface AppState {
  authenticated: boolean;
  user: AppUser;
  docs: DocItem[];
  view: ViewKey;
  activeDocId: string | null;
  search: string;
  sort: "updated" | "name" | "created";
  typeFilter: DocType | "all";
  tagFilter: string | null;
  shareDocId: string | null;
  uploadOpen: boolean;
  createOpen: boolean;
  upgradeOpen: boolean;
  sidebarOpen: boolean;
  toasts: Toast[];
  saving: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
}

interface AppActions {
  login: (credentials: { name?: string; email: string; password: string; mode?: "signin" | "signup" }) => Promise<void>;
  logout: () => Promise<void>;
  setView: (v: ViewKey) => void;
  openDoc: (id: string) => void;
  closeDoc: () => void;
  setSearch: (s: string) => void;
  setSort: (s: AppState["sort"]) => void;
  setTypeFilter: (t: AppState["typeFilter"]) => void;
  setTagFilter: (t: string | null) => void;
  setShareDocId: (id: string | null) => void;
  setUploadOpen: (b: boolean) => void;
  setCreateOpen: (b: boolean) => void;
  setUpgradeOpen: (b: boolean) => void;
  setSidebarOpen: (b: boolean) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  createDoc: (opts?: { title?: string; type?: DocType; content?: string; templateName?: string }) => DocItem;
  updateDoc: (id: string, patch: Partial<DocItem>) => void;
  toggleStar: (id: string) => void;
  deleteDoc: (id: string) => Promise<boolean>;
  duplicateDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, title: string) => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  refreshCollaborators: (docId: string) => Promise<void>;
  shareWithUser: (docId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  changeCollaboratorRole: (docId: string, userId: string, role: "editor" | "viewer") => Promise<void>;
  removeCollaborator: (docId: string, userId: string) => Promise<void>;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };
  const inline = (value: string) => escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextList = unordered ? "ul" : "ol";
      if (list !== nextList) {
        closeList();
        list = nextList;
        output.push(`<${list}>`);
      }
      output.push(`<li>${inline((unordered ?? ordered)![1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(inline(line));
    }
  }
  flushParagraph();
  closeList();
  return output.join("");
}

function importedTextToHtml(text: string): string {
  return text.replace(/\r\n?/g, "\n").split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function normalizeDoc(data: any): DocItem {
  const content = typeof data.content === "string" ? data.content : "";
  const text = stripHtml(content);
  const updatedAt = data.updatedAt ?? data.createdAt ?? new Date().toISOString();

  return {
    id: String(data.id ?? uid("doc")),
    title: String(data.title ?? "Untitled document"),
    excerpt: String(data.excerpt ?? (text ? text.slice(0, 120) : "A fresh DocSpace document.")),
    content,
    type: (data.type ?? "doc") as DocType,
    owner: String(data.owner ?? CURRENT_USER.name),
    updatedAt,
    createdAt: String(data.createdAt ?? updatedAt),
    starred: Boolean(data.starred),
    shared: Boolean(data.shared),
    sharedWithMe: Boolean(data.sharedWithMe),
    trashed: Boolean(data.trashed),
    collaborators: Array.isArray(data.collaborators)
      ? data.collaborators
      : [{ id: "owner", name: data.owner ?? CURRENT_USER.name, email: data.ownerEmail ?? CURRENT_USER.email, avatarColor: "bg-orange-500", role: "owner" }],
    tags: Array.isArray(data.tags) ? data.tags : [],
    wordCount: Number(data.wordCount ?? (text ? text.split(/\s+/).filter(Boolean).length : 0)),
    readMinutes: Number(data.readMinutes ?? Math.max(1, Math.ceil((text ? text.split(/\s+/).filter(Boolean).length : 0) / 180))),
    cover: data.cover ?? null,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser>(CURRENT_USER);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [view, setViewState] = useState<ViewKey>("home");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AppState["sort"]>("updated");
  const [typeFilter, setTypeFilter] = useState<AppState["typeFilter"]>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const toastTimer = useRef<Record<string, number>>({});
  const saveRequestRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (toastTimer.current[id]) {
      window.clearTimeout(toastTimer.current[id]);
      delete toastTimer.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid("toast");
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      toastTimer.current[id] = window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast]
  );

  const hydrateDocs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, { credentials: "include" });
      if (!response.ok) {
        setDocs([]);
        return;
      }
      const data = await response.json();
      setDocs(Array.isArray(data.documents) ? data.documents.map(normalizeDoc) : []);
    } catch {
      setDocs([]);
    }
  }, []);

  const hydrateSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
      if (!response.ok) {
        setAuthenticated(false);
        setUser(CURRENT_USER);
        setDocs([]);
        return;
      }
      const data = await response.json();
      setUser({ ...CURRENT_USER, ...(data.user ?? {}) });
      setAuthenticated(true);
      await hydrateDocs();
      pushToast({ title: "Welcome back to DocSpace", description: `Signed in as ${data.user?.name ?? CURRENT_USER.name}.`, kind: "success" });
    } catch {
      setAuthenticated(false);
      setUser(CURRENT_USER);
      setDocs([]);
    }
  }, [hydrateDocs, pushToast]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const login = useCallback(
    async (payload: { name?: string; email: string; password: string; mode?: "signin" | "signup" }) => {
      const endpoint = payload.mode === "signup" ? "/api/auth/signup" : "/api/auth/login";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(payload.name ? { name: payload.name } : {}),
          email: payload.email,
          password: payload.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Authentication failed.");
      }

      setUser({ ...CURRENT_USER, ...(data.user ?? {}) });
      setAuthenticated(true);
      setDocs([]);
      await hydrateDocs();
      pushToast({ title: data.message ?? "Welcome back to DocSpace", kind: "success" });
    },
    [hydrateDocs, pushToast]
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // no-op: local UI state should still clear even if the server request fails
    }

    setAuthenticated(false);
    setUser(CURRENT_USER);
    setDocs([]);
    setActiveDocId(null);
    setViewState("home");
    setSidebarOpen(false);
    setSaveStatus("saved");
    setLastSavedAt(null);
    pushToast({ title: "Signed out", description: "Your session has been cleared.", kind: "info" });
  }, [pushToast]);

  const setView = useCallback((v: ViewKey) => {
    setViewState(v);
    setActiveDocId(null);
    setSidebarOpen(false);
  }, []);

  const openDoc = useCallback((id: string) => {
    setActiveDocId(id);
    setSidebarOpen(false);
  }, []);

  const closeDoc = useCallback(() => setActiveDocId(null), []);

  const createDoc = useCallback(
    (opts?: { title?: string; type?: DocType; content?: string; templateName?: string }) => {
      const now = new Date().toISOString();
      const tempId = uid("doc");
      const doc: DocItem = {
        id: tempId,
        title: opts?.title ?? "Untitled document",
        excerpt: "A fresh canvas. Start writing something great.",
        content: opts?.content ?? `<h1>${escapeHtml(opts?.title ?? "Untitled document")}</h1><p>Start writing — your work autosaves as you type.</p>`,
        type: opts?.type ?? "doc",
        owner: user.name,
        updatedAt: now,
        createdAt: now,
        starred: false,
        shared: false,
        trashed: false,
        collaborators: [{ id: user.email, name: user.name, email: user.email, avatarColor: "bg-orange-500", role: "owner" }],
        tags: opts?.templateName ? [opts.templateName] : [],
        wordCount: 8,
        readMinutes: 1,
        cover: null,
      };

      setDocs((d) => [doc, ...d]);
      setActiveDocId(tempId);

      void fetch(`${API_BASE_URL}/api/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: doc.title,
          content: doc.content,
          type: doc.type,
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message ?? "Document creation failed.");
          }
          const createdDoc = normalizeDoc(data.document);
          setDocs((d) => [createdDoc, ...d.filter((entry) => entry.id !== tempId)]);
          setActiveDocId(createdDoc.id);
          pushToast({ title: "Document created", description: createdDoc.title, kind: "success" });
        })
        .catch(() => {
          setDocs((d) => d.filter((entry) => entry.id !== tempId));
          setActiveDocId(null);
          pushToast({ title: "Document creation failed", description: "The draft was not saved to the server.", kind: "error" });
        });

      return doc;
    },
    [pushToast, user.email, user.name]
  );

  const updateDoc = useCallback(
    (id: string, patch: Partial<DocItem>) => {
      const requestId = (saveRequestRef.current[id] ?? 0) + 1;
      saveRequestRef.current[id] = requestId;
      setSaving(true);
      setSaveStatus("saving");
      setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)));

      const payload: Record<string, unknown> = {};
      if (patch.title !== undefined) payload.title = patch.title;
      if (patch.content !== undefined) payload.content = patch.content;
      if (patch.type !== undefined) payload.type = patch.type;
      if (patch.excerpt !== undefined) payload.excerpt = patch.excerpt;

      void fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message ?? "Document update failed.");
          }
          if (saveRequestRef.current[id] !== requestId) {
            return;
          }
          setDocs((ds) => ds.map((d) => (d.id === id ? normalizeDoc(data.document) : d)));
          setLastSavedAt(new Date().toISOString());
          setSaveStatus("saved");
          setSaving(false);
        })
        .catch(() => {
          if (saveRequestRef.current[id] !== requestId) {
            return;
          }
          setSaveStatus("error");
          setSaving(false);
          pushToast({ title: "Save failed", description: "Changes were not persisted.", kind: "error" });
        });
    },
    [pushToast]
  );

  const toggleStar = useCallback(
    (id: string) => {
      setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d)));
      const doc = docs.find((d) => d.id === id);
      if (doc) pushToast({ title: doc.starred ? "Removed from Starred" : "Added to Starred", description: "Starred status is only stored for this session.", kind: "info" });
    },
    [docs, pushToast]
  );

  const deleteDoc = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not delete the document.");
      setDocs((current) => current.filter((doc) => doc.id !== id));
      if (activeDocId === id) setActiveDocId(null);
      pushToast({ title: "Document deleted", description: "Deletion is permanent in this build.", kind: "success" });
      return true;
    } catch (error) {
      pushToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "The document was not deleted.",
        kind: "error",
      });
      return false;
    }
  }, [activeDocId, pushToast]);

  const duplicateDoc = useCallback(
    async (id: string) => {
      const src = docs.find((d) => d.id === id);
      if (!src) return;
      const title = `${src.title} (copy)`;
      try {
        const response = await fetch(`${API_BASE_URL}/api/documents`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content: src.content, type: src.type }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Document duplication failed.");
        const copy = normalizeDoc(data.document);
        setDocs((current) => [copy, ...current]);
        pushToast({ title: "Document duplicated", description: copy.title, kind: "success" });
      } catch (error) {
        pushToast({
          title: "Document duplication failed",
          description: error instanceof Error ? error.message : "The copy was not saved.",
          kind: "error",
        });
      }
    },
    [docs, pushToast]
  );

  const renameDoc = useCallback(async (id: string, title: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "The document title was not updated.");
      const updatedDoc = normalizeDoc(data.document);
      setDocs((current) => current.map((doc) => doc.id === id ? updatedDoc : doc));
      pushToast({ title: "Document renamed", description: updatedDoc.title, kind: "success" });
    } catch (error) {
      pushToast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "The document title was not updated.",
        kind: "error",
      });
    }
  }, [pushToast]);

  const importFiles = useCallback(
    async (files: File[]) => {
      const maxBytes = 500_000;
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (!["txt", "md", "markdown"].includes(extension ?? "")) {
          rejected.push(`${file.name}: only TXT and Markdown are supported`);
        } else if (file.size > maxBytes) {
          rejected.push(`${file.name}: exceeds the 500 KB limit`);
        } else {
          accepted.push(file);
        }
      }

      const imported: DocItem[] = [];
      setSaving(true);
      try {
        for (const file of accepted) {
          const text = await file.text();
          const title = file.name.replace(/\.[^.]+$/, "").trim() || "Imported document";
          const extension = file.name.split(".").pop()?.toLowerCase();
          const body = extension === "txt" ? importedTextToHtml(text) : markdownToHtml(text);
          const content = `<h1>${escapeHtml(title)}</h1>${body || "<p></p>"}`;
          const response = await fetch(`${API_BASE_URL}/api/documents`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content, type: "note" }),
          });
          const data = await response.json();
          if (!response.ok) {
            rejected.push(`${file.name}: ${data.message ?? "import failed"}`);
            continue;
          }
          imported.push(normalizeDoc(data.document));
        }
      } catch {
        pushToast({ title: "Import failed", description: "Could not read or save one or more files.", kind: "error" });
      } finally {
        setSaving(false);
      }

      if (imported.length) {
        setDocs((current) => [...imported, ...current]);
        setLastSavedAt(new Date().toISOString());
        pushToast({
          title: imported.length === 1 ? "Document imported" : `${imported.length} documents imported`,
          description: imported[0].title,
          kind: "success",
        });
      }
      if (rejected.length) {
        pushToast({ title: "Some files were not imported", description: rejected.join("; ").slice(0, 240), kind: "warning" });
      }
    },
    [pushToast]
  );

  const refreshCollaborators = useCallback(async (docId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/collaborators`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not load collaborators.");
    setDocs((current) => current.map((doc) => doc.id === docId
      ? { ...doc, collaborators: data.collaborators as Collaborator[], shared: (data.collaborators as Collaborator[]).length > 1 }
      : doc));
  }, []);

  const shareWithUser = useCallback(async (docId: string, email: string, role: "editor" | "viewer") => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/collaborators`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not share the document.");
    setDocs((current) => current.map((doc) => doc.id === docId
      ? { ...doc, collaborators: data.collaborators as Collaborator[], shared: true }
      : doc));
  }, []);

  const changeCollaboratorRole = useCallback(async (docId: string, userId: string, role: "editor" | "viewer") => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/collaborators/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not update collaborator access.");
    setDocs((current) => current.map((doc) => doc.id === docId
      ? { ...doc, collaborators: data.collaborators as Collaborator[] }
      : doc));
  }, []);

  const removeCollaborator = useCallback(async (docId: string, userId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/collaborators/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not remove collaborator.");
    setDocs((current) => current.map((doc) => doc.id === docId
      ? { ...doc, collaborators: data.collaborators as Collaborator[], shared: (data.collaborators as Collaborator[]).length > 1 }
      : doc));
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      user,
      docs,
      view,
      activeDocId,
      search,
      sort,
      typeFilter,
      tagFilter,
      shareDocId,
      uploadOpen,
      createOpen,
      upgradeOpen,
      sidebarOpen,
      toasts,
      saving,
      saveStatus,
      lastSavedAt,
      login,
      logout,
      setView,
      openDoc,
      closeDoc,
      setSearch,
      setSort,
      setTypeFilter,
      setTagFilter,
      setShareDocId,
      setUploadOpen,
      setCreateOpen,
      setUpgradeOpen,
      setSidebarOpen,
      pushToast,
      dismissToast,
      createDoc,
      updateDoc,
      toggleStar,
      deleteDoc,
      duplicateDoc,
      renameDoc,
      importFiles,
      refreshCollaborators,
      shareWithUser,
      changeCollaboratorRole,
      removeCollaborator,
    }),
    [
      authenticated,
      user,
      docs,
      view,
      activeDocId,
      search,
      sort,
      typeFilter,
      tagFilter,
      shareDocId,
      uploadOpen,
      createOpen,
      upgradeOpen,
      sidebarOpen,
      toasts,
      saving,
      saveStatus,
      lastSavedAt,
      login,
      logout,
      setView,
      openDoc,
      closeDoc,
      setSearch,
      setSort,
      setTypeFilter,
      setTagFilter,
      setShareDocId,
      setUploadOpen,
      setCreateOpen,
      setUpgradeOpen,
      setSidebarOpen,
      pushToast,
      dismissToast,
      createDoc,
      updateDoc,
      toggleStar,
      deleteDoc,
      duplicateDoc,
      renameDoc,
      importFiles,
      refreshCollaborators,
      shareWithUser,
      changeCollaboratorRole,
      removeCollaborator,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
