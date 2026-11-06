import type { Request, Response, Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { load } from "cheerio";
import ExcelJS from "exceljs";
import htmlToDocx from "html-to-docx";
import PDFDocument from "pdfkit";
import TurndownService from "turndown";
import { db } from "../db/index.js";
import { documentCollaborators, documentPermissions, documents, users } from "../db/schema.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const documentSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  content: z.string().optional(),
  type: z.enum(["doc", "sheet", "slides", "pdf", "note", "whiteboard"]).optional(),
  excerpt: z.string().optional(),
});
const collaboratorSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  role: z.enum(["editor", "viewer"]),
});
const collaboratorRoleSchema = z.object({
  role: z.enum(["editor", "viewer"]),
});
const EXPORTS = {
  txt: { mime: "text/plain; charset=utf-8", extension: "txt" },
  md: { mime: "text/markdown; charset=utf-8", extension: "md" },
  html: { mime: "text/html; charset=utf-8", extension: "html" },
  pdf: { mime: "application/pdf", extension: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
  csv: { mime: "text/csv; charset=utf-8", extension: "csv" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
} as const;
type ExportFormat = keyof typeof EXPORTS;

function isExportFormat(value: string): value is ExportFormat {
  return value in EXPORTS;
}

function safeFilename(title: string, extension: string): string {
  const basename = title.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").trim();
  return `${(basename || "document").slice(0, 100)}.${extension}`;
}

function getExportHtml(content: string): string {
  const $ = load(`<div>${content}</div>`);
  $("script, style, iframe, object, embed, img, video, audio, source").remove();
  $("*").each((_, element) => {
    if (!("attribs" in element)) return;
    const node = $(element);
    for (const attribute of Object.keys(element.attribs)) {
      if (attribute.toLowerCase().startsWith("on")) node.removeAttr(attribute);
    }
    if (node.is("a")) {
      const href = node.attr("href")?.trim() ?? "";
      if (href && !/^(https?:|mailto:|\/|#)/i.test(href)) node.removeAttr("href");
    }
  });
  return $("div").first().html() ?? "";
}

function spreadsheetRows(html: string): string[][] {
  const $ = load(html);
  const rows = $("table tr").toArray().map((row) =>
    $(row).find("th, td").toArray().map((cell) => $(cell).text().trim())
  ).filter((row) => row.length > 0);
  return rows.length ? rows : [[$.root().text().trim()]];
}

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function htmlText(html: string): string {
  const $ = load(html);
  $("br").replaceWith("\n");
  $("p, h1, h2, h3, li, tr, blockquote, pre").each((_, element) => {
    $(element).append("\n");
  });
  return $.root().text().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function createPdf(title: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 54, bufferPages: true });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(20).text(title, { continued: false });
    pdf.moveDown();
    pdf.fontSize(11).text(text || " ");
    pdf.end();
  });
}

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

type SerializedCollaborator = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function serializeDocument(
  doc: typeof documents.$inferSelect,
  ownerName: string,
  ownerEmail: string,
  viewerId: string,
  collaborators: SerializedCollaborator[]
): Record<string, unknown> {
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

async function serializeDocuments(
  entries: Array<{ doc: typeof documents.$inferSelect; owner: { id: string; name: string; email: string } }>,
  viewerId: string
): Promise<Record<string, unknown>[]> {
  if (entries.length === 0) return [];
  const documentIds = entries.map(({ doc }) => doc.id);
  const rows = await db
    .select({
      documentId: documentCollaborators.documentId,
      id: users.id,
      name: users.name,
      email: users.email,
      role: documentCollaborators.role,
    })
    .from(documentCollaborators)
    .innerJoin(users, eq(users.id, documentCollaborators.userId))
    .where(inArray(documentCollaborators.documentId, documentIds));
  const collaboratorsByDocument = new Map<string, SerializedCollaborator[]>();
  for (const row of rows) {
    const collaborators = collaboratorsByDocument.get(row.documentId) ?? [];
    collaborators.push({ id: row.id, name: row.name, email: row.email, role: row.role });
    collaboratorsByDocument.set(row.documentId, collaborators);
  }

  return entries.map(({ doc, owner }) =>
    serializeDocument(doc, owner.name, owner.email, viewerId, collaboratorsByDocument.get(doc.id) ?? [])
  );
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

  router.get("/storage", asyncHandler(async (req: Request, res: Response) => {
    const rows = await db
      .select({
        type: documents.type,
        documentCount: sql<number>`count(*)`,
        bytes: sql<number>`sum(octet_length(${documents.title}) + octet_length(${documents.content}) + octet_length(coalesce(${documents.excerpt}, '')))`,
      })
      .from(documents)
      .where(eq(documents.ownerId, req.user!.id))
      .groupBy(documents.type);
    const byType = Object.fromEntries(rows.map((row) => [row.type, {
      documentCount: Number(row.documentCount),
      bytes: Number(row.bytes ?? 0),
    }]));
    res.json({
      ok: true,
      storage: {
        documentCount: rows.reduce((total, row) => total + Number(row.documentCount), 0),
        bytes: rows.reduce((total, row) => total + Number(row.bytes ?? 0), 0),
        byType,
        basis: "UTF-8 bytes of owned document titles, content and excerpts; excludes database overhead and shared-in documents.",
      },
    });
  }));

  router.get("/", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [ownedDocs, sharedDocs, collaboratorDocs] = await Promise.all([
      db.select().from(documents).where(eq(documents.ownerId, userId)),
      db
        .select({
          doc: documents,
          owner: { id: users.id, name: users.name, email: users.email },
        })
        .from(documentPermissions)
        .innerJoin(documents, eq(documents.id, documentPermissions.documentId))
        .innerJoin(users, eq(users.id, documents.ownerId))
        .where(eq(documentPermissions.userId, userId)),
      db
        .select({
          doc: documents,
          owner: { id: users.id, name: users.name, email: users.email },
        })
        .from(documentCollaborators)
        .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
        .innerJoin(users, eq(users.id, documents.ownerId))
        .where(eq(documentCollaborators.userId, userId)),
    ]);

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
    const serializedDocs = await serializeDocuments(docsList, userId);

    res.json({ ok: true, documents: serializedDocs });
  }));

  router.get("/shared", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const [rows, legacyRows] = await Promise.all([
      db
        .select({
          doc: documents,
          owner: { id: users.id, name: users.name, email: users.email },
        })
        .from(documentCollaborators)
        .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
        .innerJoin(users, eq(users.id, documents.ownerId))
        .where(eq(documentCollaborators.userId, userId)),
      db
        .select({
          doc: documents,
          owner: { id: users.id, name: users.name, email: users.email },
        })
        .from(documentPermissions)
        .innerJoin(documents, eq(documents.id, documentPermissions.documentId))
        .innerJoin(users, eq(users.id, documents.ownerId))
        .where(eq(documentPermissions.userId, userId)),
    ]);
    const merged = new Map<string, (typeof rows)[number]>();
    for (const row of [...rows, ...legacyRows]) merged.set(row.doc.id, row);
    const shared = await serializeDocuments(Array.from(merged.values()), userId);
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

    res.status(201).json({
      ok: true,
      document: serializeDocument(created, req.user!.name, req.user!.email, userId, []),
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

  router.get("/:id/export/:format", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawFormat = Array.isArray(req.params.format) ? req.params.format[0] : req.params.format;
    if (!isExportFormat(rawFormat)) {
      res.status(400).json({ ok: false, message: "Unsupported export format." });
      return;
    }

    const { doc } = await getDocumentForUser(req.user!.id, documentId);
    const spreadsheet = doc.type === "sheet";
    const supported = spreadsheet ? ["csv", "xlsx", "pdf"] : ["txt", "md", "html", "pdf", "docx"];
    if (!supported.includes(rawFormat)) {
      res.status(400).json({ ok: false, message: "That export format is not supported for this document type." });
      return;
    }

    const html = getExportHtml(doc.content);
    const text = htmlText(html);
    let output: Buffer | string;
    if (rawFormat === "txt") {
      output = `${doc.title}\n\n${text}\n`;
    } else if (rawFormat === "md") {
      output = `# ${doc.title}\n\n${new TurndownService().turndown(html)}\n`;
    } else if (rawFormat === "html") {
      output = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!)}</title></head><body><h1>${doc.title.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!)}</h1>${html}</body></html>`;
    } else if (rawFormat === "pdf") {
      output = await createPdf(doc.title, spreadsheet
        ? spreadsheetRows(html).map((row) => row.join("\t")).join("\n")
        : text);
    } else if (rawFormat === "docx") {
      const docx = await htmlToDocx(`<h1>${doc.title}</h1>${html}`);
      output = Buffer.isBuffer(docx) ? docx : Buffer.from(await docx.arrayBuffer());
    } else if (rawFormat === "csv") {
      output = spreadsheetRows(html).map((row) => row.map(csvCell).join(",")).join("\r\n");
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sheet1");
      const rows = spreadsheetRows(html);
      sheet.addRows(rows);
      sheet.columns.forEach((column, index) => {
        column.width = Math.min(60, Math.max(12, ...rows.map((row) => (row[index] ?? "").length + 2)));
      });
      output = Buffer.from(await workbook.xlsx.writeBuffer());
    }

    res.setHeader("Content-Type", EXPORTS[rawFormat].mime);
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(doc.title, EXPORTS[rawFormat].extension)}"`);
    res.send(output);
  }));

  router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const access = await getDocumentForUser(req.user!.id, documentId);
    res.json({
      ok: true,
      document: (await serializeDocuments([{ doc: access.doc, owner: access.owner }], req.user!.id))[0],
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
      document: (await serializeDocuments([{ doc: updated, owner: access.owner }], req.user!.id))[0],
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
