import type { Request, Response, Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { documentCollaborators, documentPermissions, documents, users } from "../db/schema.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const documentSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  content: z.string().optional(),
  type: z.string().min(1).optional(),
  excerpt: z.string().optional(),
});
const collaboratorSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  role: z.enum(["editor", "viewer"]),
});
const collaboratorRoleSchema = z.object({
  role: z.enum(["editor", "viewer"]),
});

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExcerpt(content: string): string {
  const text = stripHtml(content || "");
  return text ? text.slice(0, 140) : "A fresh DocSpace document.";
}

function getWordCount(content: string): number {
  const text = stripHtml(content || "");
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

async function serializeDocument(doc: typeof documents.$inferSelect, ownerName: string, ownerEmail: string, viewerId: string): Promise<Record<string, unknown>> {
  const collaborators = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: documentCollaborators.role,
    })
    .from(documentCollaborators)
    .innerJoin(users, eq(users.id, documentCollaborators.userId))
    .where(eq(documentCollaborators.documentId, doc.id));

  return {
    id: doc.id,
    title: doc.title,
    excerpt: doc.excerpt || getExcerpt(doc.content),
    content: doc.content,
    type: doc.type || "doc",
    owner: ownerName,
    ownerEmail,
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    starred: false,
    shared: Boolean(doc.isShared),
    sharedWithMe: doc.ownerId !== viewerId,
    trashed: false,
    collaborators: [
      {
        id: doc.ownerId,
        name: ownerName,
        email: ownerEmail,
        avatarColor: "bg-orange-500",
        role: "owner",
      },
      ...collaborators.map((collaborator) => ({
        ...collaborator,
        avatarColor: "bg-emerald-600",
      })),
    ],
    tags: [],
    wordCount: getWordCount(doc.content),
    readMinutes: Math.max(1, Math.ceil(getWordCount(doc.content) / 180)),
    cover: null,
  };
}

async function getDocumentForUser(userId: string, documentId: string): Promise<{ doc: typeof documents.$inferSelect; owner: { id: string; name: string; email: string }; permission: string | null; collaboratorRole: string | null; canRead: boolean; canWrite: boolean }> {
  const [row] = await db
    .select({
      doc: documents,
      owner: { id: users.id, name: users.name, email: users.email },
      permission: documentPermissions.permission,
      collaboratorRole: documentCollaborators.role,
    })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.ownerId))
    .leftJoin(documentPermissions, and(eq(documentPermissions.documentId, documents.id), eq(documentPermissions.userId, userId)))
    .leftJoin(documentCollaborators, and(eq(documentCollaborators.documentId, documents.id), eq(documentCollaborators.userId, userId)))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("Document not found."), { statusCode: 404 });
  }

  const owner = row.owner ?? { id: "", name: "Unknown user", email: "" };
  const canRead = row.doc.ownerId === userId || Boolean(row.collaboratorRole) || Boolean(row.permission);
  if (!canRead) {
    throw Object.assign(new Error("You do not have access to this document."), { statusCode: 403 });
  }

  const canWrite = row.doc.ownerId === userId || (row.collaboratorRole ? row.collaboratorRole === "editor" : row.permission === "write");

  return {
    doc: row.doc,
    owner,
    permission: row.permission ?? null,
    collaboratorRole: row.collaboratorRole ?? null,
    canRead,
    canWrite,
  };
}

async function requireOwner(userId: string, documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) {
    throw Object.assign(new Error("Document not found."), { statusCode: 404 });
  }
  if (doc.ownerId !== userId) {
    throw Object.assign(new Error("Only the document owner can manage collaborators."), { statusCode: 403 });
  }
  return doc;
}

async function getCollaboratorList(documentId: string, ownerId: string) {
  const [owner] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  const collaborators = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: documentCollaborators.role,
    })
    .from(documentCollaborators)
    .innerJoin(users, eq(users.id, documentCollaborators.userId))
    .where(eq(documentCollaborators.documentId, documentId));

  return [
    ...(owner ? [{ ...owner, role: "owner" as const, avatarColor: "bg-orange-500" }] : []),
    ...collaborators.map((collaborator) => ({
      ...collaborator,
      role: collaborator.role as "editor" | "viewer",
      avatarColor: "bg-emerald-600",
    })),
  ];
}

export function registerDocumentRoutes(router: Router): void {
  router.use(requireAuth);

  router.get("/", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const ownedDocs = await db.select().from(documents).where(eq(documents.ownerId, userId));
    const sharedDocs = await db
      .select({
        doc: documents,
        owner: { id: users.id, name: users.name, email: users.email },
      })
      .from(documentPermissions)
      .innerJoin(documents, eq(documents.id, documentPermissions.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentPermissions.userId, userId));

    const collaboratorDocs = await db
      .select({
        doc: documents,
        owner: { id: users.id, name: users.name, email: users.email },
      })
      .from(documentCollaborators)
      .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentCollaborators.userId, userId));

    const merged = new Map<string, { doc: typeof documents.$inferSelect; owner: { id: string; name: string; email: string } }>();

    for (const row of ownedDocs) {
      merged.set(row.id, { doc: row, owner: { id: userId, name: req.user!.name, email: req.user!.email } });
    }

    for (const row of sharedDocs) {
      merged.set(row.doc.id, { doc: row.doc, owner: row.owner });
    }
    for (const row of collaboratorDocs) {
      merged.set(row.doc.id, { doc: row.doc, owner: row.owner });
    }

    const docsList = Array.from(merged.values())
      .sort((a, b) => new Date(b.doc.updatedAt).getTime() - new Date(a.doc.updatedAt).getTime());
    const serializedDocs = await Promise.all(docsList.map(({ doc, owner }) => serializeDocument(doc, owner.name, owner.email, userId)));

    res.json({ ok: true, documents: serializedDocs });
  }));

  router.get("/shared", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const rows = await db
      .select({
        doc: documents,
        owner: { id: users.id, name: users.name, email: users.email },
      })
      .from(documentCollaborators)
      .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentCollaborators.userId, userId));
    const legacyRows = await db
      .select({
        doc: documents,
        owner: { id: users.id, name: users.name, email: users.email },
      })
      .from(documentPermissions)
      .innerJoin(documents, eq(documents.id, documentPermissions.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentPermissions.userId, userId));
    const merged = new Map<string, (typeof rows)[number]>();
    for (const row of [...rows, ...legacyRows]) merged.set(row.doc.id, row);
    const shared = await Promise.all(
      Array.from(merged.values()).map(({ doc, owner }) => serializeDocument(doc, owner.name, owner.email, userId))
    );
    res.json({ ok: true, documents: shared });
  }));

  router.post("/", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const payload = documentSchema.parse(req.body ?? {});

    const title = payload.title ?? "Untitled document";
    const content = payload.content ?? "";
    const type = payload.type ?? "doc";
    const excerpt = payload.excerpt ?? getExcerpt(content);

    const [created] = await db
      .insert(documents)
      .values({
        title,
        content,
        excerpt,
        type,
        ownerId: userId,
        isShared: false,
      })
      .returning();

    const owner = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const ownerRecord = owner[0];

    res.status(201).json({
      ok: true,
      document: await serializeDocument(created, ownerRecord.name, ownerRecord.email, userId),
    });
  }));

  router.get("/:id/collaborators", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const access = await getDocumentForUser(req.user!.id, documentId);
    res.json({ ok: true, collaborators: await getCollaboratorList(documentId, access.doc.ownerId) });
  }));

  router.post("/:id/collaborators", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const owner = await requireOwner(req.user!.id, documentId);
    const payload = collaboratorSchema.parse(req.body ?? {});
    const email = payload.email.toLowerCase();
    const [collaborator] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!collaborator) {
      res.status(404).json({ ok: false, message: "No registered user was found with that email." });
      return;
    }
    if (collaborator.id === owner.ownerId) {
      res.status(400).json({ ok: false, message: "The document owner already has access." });
      return;
    }

    await db
      .insert(documentCollaborators)
      .values({ documentId, userId: collaborator.id, role: payload.role })
      .onConflictDoUpdate({
        target: [documentCollaborators.documentId, documentCollaborators.userId],
        set: { role: payload.role },
      });
    await db.update(documents).set({ isShared: true }).where(eq(documents.id, documentId));

    res.status(200).json({
      ok: true,
      collaborator: {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        role: payload.role,
        avatarColor: "bg-emerald-600",
      },
      collaborators: await getCollaboratorList(documentId, owner.ownerId),
    });
  }));

  router.patch("/:id/collaborators/:userId", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const owner = await requireOwner(req.user!.id, documentId);
    const payload = collaboratorRoleSchema.parse(req.body ?? {});
    const [updated] = await db
      .update(documentCollaborators)
      .set({ role: payload.role })
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, targetUserId)))
      .returning();

    if (!updated) {
      res.status(404).json({ ok: false, message: "Collaborator not found." });
      return;
    }
    res.json({ ok: true, collaborators: await getCollaboratorList(documentId, owner.ownerId) });
  }));

  router.delete("/:id/collaborators/:userId", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const owner = await requireOwner(req.user!.id, documentId);
    const deleted = await db
      .delete(documentCollaborators)
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, targetUserId)))
      .returning({ id: documentCollaborators.id });

    if (deleted.length === 0) {
      res.status(404).json({ ok: false, message: "Collaborator not found." });
      return;
    }
    const remaining = await db.select().from(documentCollaborators).where(eq(documentCollaborators.documentId, documentId));
    await db.update(documents).set({ isShared: remaining.length > 0 }).where(eq(documents.id, documentId));
    res.json({ ok: true, collaborators: await getCollaboratorList(documentId, owner.ownerId) });
  }));

  router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const access = await getDocumentForUser(req.user!.id, documentId);
    res.json({
      ok: true,
      document: await serializeDocument(access.doc, access.owner.name, access.owner.email, req.user!.id),
    });
  }));

  router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = documentSchema.partial().parse(req.body ?? {});
    const access = await getDocumentForUser(req.user!.id, documentId);

    if (!access.canWrite) {
      res.status(403).json({ ok: false, message: "You do not have permission to edit this document." });
      return;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (payload.title !== undefined) {
      updateData.title = payload.title.trim() || "Untitled document";
    }
    if (payload.content !== undefined) {
      updateData.content = payload.content;
      updateData.excerpt = payload.excerpt ?? getExcerpt(payload.content);
    }
    if (payload.type !== undefined) {
      updateData.type = payload.type;
    }
    if (payload.excerpt !== undefined && payload.content === undefined) {
      updateData.excerpt = payload.excerpt;
    }

    const [updated] = await db.update(documents).set(updateData).where(eq(documents.id, documentId)).returning();

    res.json({
      ok: true,
      document: await serializeDocument(updated, access.owner.name, access.owner.email, req.user!.id),
    });
  }));

  router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const access = await getDocumentForUser(req.user!.id, documentId);

    if (access.doc.ownerId !== req.user!.id) {
      res.status(403).json({ ok: false, message: "Only the owner can delete this document." });
      return;
    }

    await db.delete(documents).where(eq(documents.id, documentId));
    res.json({ ok: true, message: "Document deleted." });
  }));
}
