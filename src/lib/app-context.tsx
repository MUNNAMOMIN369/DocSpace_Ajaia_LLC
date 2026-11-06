import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CURRENT_USER, uid, type Collaborator, type DocItem, type DocType, type Toast, type ViewKey } from "./store";

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL ?? ""
  : "";

type SaveStatus = "saving" | "saved" | "error";
export type ExportFormat = "txt" | "md" | "html" | "pdf" | "docx" | "csv" | "xlsx";
type StorageUsage = {
  bytes: number;
  documentCount: number;
  byType: Record<string, { bytes: number; documentCount: number }>;
  basis: string;
};
type AppUser = typeof CURRENT_USER & { id?: string };
type ApiResponse = {
  message?: string;
  user?: Partial<AppUser>;
  [key: string]: unknown;
};

interface AppState {
  authenticated: boolean;
  user: AppUser;
  docs: DocItem[];
  documentsLoading: boolean;
  storageUsage: StorageUsage | null;
  storageLoading: boolean;
  storageError: string | null;
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
  createDoc: (opts?: { title?: string; type?: DocType; content?: string; templateName?: string }) => Promise<boolean>;
  refreshStorage: () => Promise<void>;
  exportDoc: (id: string, format: ExportFormat) => Promise<void>;
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

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`API returned a non-JSON response (HTTP ${response.status}).`);
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`API returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`API returned an unexpected JSON response (HTTP ${response.status}).`);
  }

  const result = data as ApiResponse;
  if (!response.ok) {
    throw new Error(
      typeof result.message === "string" ? result.message : `API request failed (HTTP ${response.status}).`
    );
  }

  return result;
}

const DOC_TYPES: readonly DocType[] = ["doc", "sheet", "slides", "pdf", "note", "whiteboard"];

function isCollaborator(value: unknown): value is Collaborator {
  if (!value || typeof value !== "object") return false;
  const person = value as Record<string, unknown>;
  return typeof person.id === "string"
    && typeof person.name === "string"
    && typeof person.email === "string"
    && typeof person.avatarColor === "string"
    && ["viewer", "commenter", "editor", "owner"].includes(String(person.role));
}

function isCover(value: unknown): value is NonNullable<DocItem["cover"]> {
  return value === "orange" || value === "peach" || value === "sand" || value === "clay" || value === "cream";
}

function normalizeDoc(input: unknown): DocItem {
  const data = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const content = typeof data.content === "string" ? data.content : "";
  const text = stripHtml(content);
  const updatedAt = typeof data.updatedAt === "string"
    ? data.updatedAt
    : typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const collaborators = Array.isArray(data.collaborators)
    ? data.collaborators.filter(isCollaborator)
    : [];
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const wordCount = Number(data.wordCount ?? (text ? text.split(/\s+/).filter(Boolean).length : 0));
  const readMinutes = Number(data.readMinutes ?? Math.max(1, Math.ceil(wordCount / 180)));

  return {
    id: String(data.id ?? uid("doc")),
    title: String(data.title ?? "Untitled document"),
    excerpt: typeof data.excerpt === "string" ? data.excerpt : (text ? text.slice(0, 120) : "A fresh DocSpace document."),
    content,
    type: DOC_TYPES.includes(data.type as DocType) ? data.type as DocType : "doc",
    owner: String(data.owner ?? CURRENT_USER.name),
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
    starred: Boolean(data.starred),
    shared: Boolean(data.shared),
    sharedWithMe: Boolean(data.sharedWithMe),
    trashed: Boolean(data.trashed),
    collaborators: collaborators.length
      ? collaborators
      : [{ id: "owner", name: String(data.owner ?? CURRENT_USER.name), email: String(data.ownerEmail ?? CURRENT_USER.email), avatarColor: "bg-orange-500", role: "owner" }],
    tags,
    wordCount: Number.isFinite(wordCount) ? wordCount : 0,
    readMinutes: Number.isFinite(readMinutes) ? readMinutes : 1,
    cover: isCover(data.cover) ? data.cover : null,
  };
}

function defaultContent(type: DocType, title: string): string {
  const heading = escapeHtml(title);
  if (type === "sheet") {
    const columns = ["A", "B", "C", "D"];
    const rows = Array.from({ length: 5 }, (_, row) =>
      `<tr><th>${row + 1}</th>${columns.map(() => `<td><br></td>`).join("")}</tr>`
    ).join("");
    return `<h1>${heading}</h1><table><thead><tr><th></th>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (type === "slides") {
    return `<h1>${heading}</h1><h2>Slide 1</h2><p>Add your presentation outline here.</p>`;
  }
  if (type === "whiteboard") {
    return `<h1>${heading}</h1><p>Start mapping out your ideas here.</p>`;
  }
  if (type === "note") {
    return `<h1>${heading}</h1><p>Capture your thoughts here.</p>`;
  }
  return `<h1>${heading}</h1><p>Start writing — your work autosaves as you type.</p>`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser>(CURRENT_USER);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
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
  const authGenerationRef = useRef(0);
  const sessionHydrationRef = useRef<Promise<void> | null>(null);
  const docsHydrationRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);

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

  const refreshStorage = useCallback(async () => {
    if (!authenticated) {
      setStorageUsage(null);
      setStorageError(null);
      return;
    }
    setStorageLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/storage`, { credentials: "include" });
      const data = await readApiResponse(response);
      if (!data.storage || typeof data.storage !== "object") {
        throw new Error("The storage response was incomplete.");
      }
      setStorageUsage(data.storage as StorageUsage);
      setStorageError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage usage could not be loaded.";
      setStorageError(message);
      pushToast({ title: "Storage usage unavailable", description: message, kind: "warning" });
    } finally {
      setStorageLoading(false);
    }
  }, [authenticated, pushToast]);

  useEffect(() => {
    if (!authenticated) return;
    void refreshStorage();
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void refreshStorage();
    };
    const intervalId = window.setInterval(() => void refreshStorage(), 60_000);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [authenticated, refreshStorage]);

  const hydrateDocs = useCallback(() => {
    const generation = authGenerationRef.current;
    if (docsHydrationRef.current?.generation === generation) {
      return docsHydrationRef.current.promise;
    }

    setDocumentsLoading(true);
    let request: Promise<void>;
    request = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/documents`, { credentials: "include" });
      const data = await readApiResponse(response);
      if (generation === authGenerationRef.current) {
        setDocs(Array.isArray(data.documents) ? data.documents.map(normalizeDoc) : []);
      }
    })()
      .catch((error: unknown) => {
        if (generation === authGenerationRef.current) {
          setDocs([]);
          pushToast({
            title: "Documents could not be loaded",
            description: error instanceof Error ? error.message : "Check your connection and try again.",
            kind: "error",
          });
        }
      })
      .finally(() => {
        if (docsHydrationRef.current?.promise === request) {
          docsHydrationRef.current = null;
        }
        if (generation === authGenerationRef.current) {
          setDocumentsLoading(false);
        }
      });
    docsHydrationRef.current = { generation, promise: request };
    return request;
  }, [pushToast]);

  const hydrateSession = useCallback(() => {
    if (sessionHydrationRef.current) {
      return sessionHydrationRef.current;
    }

    const generation = authGenerationRef.current;
    let request: Promise<void>;
    request = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (generation !== authGenerationRef.current) return;
        if (!response.ok) {
          setAuthenticated(false);
          setUser(CURRENT_USER);
          setDocs([]);
          setStorageUsage(null);
          setStorageError(null);
          return;
        }
        const data = await readApiResponse(response);
        if (generation !== authGenerationRef.current) return;
        setUser({ ...CURRENT_USER, ...(data.user ?? {}) });
        setAuthenticated(true);
        void hydrateDocs();
        pushToast({ title: "Welcome back to DocSpace", description: `Signed in as ${data.user?.name ?? CURRENT_USER.name}.`, kind: "success" });
      } catch {
        if (generation === authGenerationRef.current) {
          setAuthenticated(false);
          setUser(CURRENT_USER);
          setDocs([]);
          pushToast({ title: "Unable to restore your session", description: "Check your connection and try signing in again.", kind: "error" });
        }
      }
    })().finally(() => {
      if (sessionHydrationRef.current === request) {
        sessionHydrationRef.current = null;
      }
    });
    sessionHydrationRef.current = request;
    return request;
  }, [hydrateDocs, pushToast]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const login = useCallback(
    async (payload: { name?: string; email: string; password: string; mode?: "signin" | "signup" }) => {
      authGenerationRef.current += 1;
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

      const data = await readApiResponse(response);

      setUser({ ...CURRENT_USER, ...(data.user ?? {}) });
      setAuthenticated(true);
      setDocs([]);
      void hydrateDocs();
      pushToast({ title: data.message ?? "Welcome back to DocSpace", kind: "success" });
    },
    [hydrateDocs, pushToast]
  );

  const logout = useCallback(async () => {
    authGenerationRef.current += 1;
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
    setDocumentsLoading(false);
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
    async (opts?: { title?: string; type?: DocType; content?: string; templateName?: string }) => {
      const type = opts?.type ?? "doc";
      const title = opts?.title ?? "Untitled document";
      const content = opts?.content ?? defaultContent(type, title);
      try {
        const response = await fetch(`${API_BASE_URL}/api/documents`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, type }),
        });
        const data = await readApiResponse(response);
        const createdDoc = normalizeDoc(data.document);
        setDocs((current) => [createdDoc, ...current.filter((entry) => entry.id !== createdDoc.id)]);
        setActiveDocId(createdDoc.id);
        void refreshStorage();
        pushToast({ title: "Document created", description: createdDoc.title, kind: "success" });
        return true;
      } catch (error) {
        pushToast({
          title: "Document creation failed",
          description: error instanceof Error ? error.message : "The document was not saved to the server.",
          kind: "error",
        });
        return false;
      }
    },
    [pushToast, refreshStorage]
  );

  const exportDoc = useCallback(async (id: string, format: ExportFormat) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}/export/${format}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        const message = contentType.includes("application/json")
          ? (await response.json() as { message?: string }).message
          : undefined;
        throw new Error(message ?? `Export failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/i.exec(disposition)?.[1] ?? `document.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      pushToast({ title: "Export ready", description: filename, kind: "success" });
    } catch (error) {
      pushToast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "The document could not be exported.",
        kind: "error",
      });
    }
  }, [pushToast]);

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
          void refreshStorage();
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
    [pushToast, refreshStorage]
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
      void refreshStorage();
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
  }, [activeDocId, pushToast, refreshStorage]);

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
        void refreshStorage();
        pushToast({ title: "Document duplicated", description: copy.title, kind: "success" });
      } catch (error) {
        pushToast({
          title: "Document duplication failed",
          description: error instanceof Error ? error.message : "The copy was not saved.",
          kind: "error",
        });
      }
    },
    [docs, pushToast, refreshStorage]
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
      void refreshStorage();
      pushToast({ title: "Document renamed", description: updatedDoc.title, kind: "success" });
    } catch (error) {
      pushToast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "The document title was not updated.",
        kind: "error",
      });
    }
  }, [pushToast, refreshStorage]);

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
        void refreshStorage();
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
    [pushToast, refreshStorage]
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
      documentsLoading,
      storageUsage,
      storageLoading,
      storageError,
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
      refreshStorage,
      exportDoc,
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
      documentsLoading,
      storageUsage,
      storageLoading,
      storageError,
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
      refreshStorage,
      exportDoc,
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
