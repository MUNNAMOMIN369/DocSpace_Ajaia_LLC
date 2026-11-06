import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt").default(""),
  type: text("type").notNull().default("doc"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ownerIdIndex: index("documents_owner_id_idx").on(table.ownerId),
}));

export const documentCollaborators = pgTable("document_collaborators", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentUserUnique: uniqueIndex("document_collaborators_document_user_unique").on(table.documentId, table.userId),
  userIdIndex: index("document_collaborators_user_id_idx").on(table.userId),
}));

export const documentPermissions = pgTable("document_permissions", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission").notNull().default("read"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentUserIndex: index("document_permissions_document_user_idx").on(table.documentId, table.userId),
  userIdIndex: index("document_permissions_user_id_idx").on(table.userId),
}));

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  collaboratorRecords: many(documentCollaborators),
  permissionRecords: many(documentPermissions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  collaborators: many(documentCollaborators),
  permissions: many(documentPermissions),
}));

export const documentCollaboratorsRelations = relations(documentCollaborators, ({ one }) => ({
  document: one(documents, {
    fields: [documentCollaborators.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentCollaborators.userId],
    references: [users.id],
  }),
}));

export const documentPermissionsRelations = relations(documentPermissions, ({ one }) => ({
  document: one(documents, {
    fields: [documentPermissions.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentPermissions.userId],
    references: [users.id],
  }),
}));
