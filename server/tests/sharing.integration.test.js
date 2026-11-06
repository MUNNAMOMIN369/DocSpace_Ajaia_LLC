import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: new URL("../../.env", import.meta.url) });

const apiBase = process.env.DOCSPACE_API_URL ?? "http://localhost:4000";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

function createSession() {
  const cookies = new Map();
  return {
    async request(method, path, payload, expectedStatus) {
      const headers = payload ? { "Content-Type": "application/json" } : {};
      if (cookies.size) {
        headers.Cookie = [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
      }

      const response = await fetch(`${apiBase}${path}`, {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const rawBody = await response.text();
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        const cookiePair = setCookie.split(";", 1)[0];
        const equals = cookiePair.indexOf("=");
        cookies.set(cookiePair.slice(0, equals), cookiePair.slice(equals + 1));
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
      console.log(`[sharing] ${method} ${path} -> ${response.status}`);
      assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(body)}`);
      return body;
    },
  };
}

const alice = {
  name: "Sharing Test Owner",
  email: `sharing-owner-${randomUUID()}@example.test`,
  password: `Owner-${randomUUID()}!`,
};
const bob = {
  name: "Sharing Test Collaborator",
  email: `sharing-collaborator-${randomUUID()}@example.test`,
  password: `Collaborator-${randomUUID()}!`,
};

let documentId;

try {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for sharing integration tests");

  const ownerSession = createSession();
  const collaboratorSession = createSession();
  const loginSession = createSession();
  const unauthenticatedSession = createSession();

  await ownerSession.request("POST", "/api/auth/signup", alice, 201);
  await collaboratorSession.request("POST", "/api/auth/signup", bob, 201);
  await loginSession.request("POST", "/api/auth/login", {
    email: alice.email,
    password: alice.password,
  }, 200);
  await loginSession.request("GET", "/api/auth/me", undefined, 200);
  await loginSession.request("POST", "/api/auth/logout", undefined, 200);
  await loginSession.request("GET", "/api/auth/me", undefined, 401);

  await unauthenticatedSession.request("GET", "/api/documents", undefined, 401);
  const created = await ownerSession.request("POST", "/api/documents", {
    title: "Sharing integration test",
    content: "<p>Initial content</p>",
    type: "doc",
  }, 201);
  documentId = created.document.id;
  const renamed = await ownerSession.request("PATCH", `/api/documents/${documentId}`, {
    title: "Renamed sharing integration test",
  }, 200);
  assert.equal(renamed.document.title, "Renamed sharing integration test");
  const reloaded = await ownerSession.request("GET", `/api/documents/${documentId}`, undefined, 200);
  assert.equal(reloaded.document.title, "Renamed sharing integration test");
  await unauthenticatedSession.request("GET", `/api/documents/${documentId}`, undefined, 401);
  await ownerSession.request("GET", "/api/documents/not-a-real-document", undefined, 404);
  await ownerSession.request("GET", `/api/documents/${documentId}`, undefined, 200);
  await ownerSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: `unregistered-${randomUUID()}@example.test`,
    role: "viewer",
  }, 404);
  await ownerSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: alice.email,
    role: "viewer",
  }, 400);
  await ownerSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: bob.email,
    role: "owner",
  }, 400);

  const shared = await ownerSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: bob.email,
    role: "editor",
  }, 200);
  const bobRecord = shared.collaborators.find((person) => person.email === bob.email);
  assert.ok(bobRecord, "Bob is listed as a collaborator");
  assert.equal(bobRecord.role, "editor");
  assert.equal(shared.collaborators.filter((person) => person.email === bob.email).length, 1);

  const sharedList = await collaboratorSession.request("GET", "/api/documents/shared", undefined, 200);
  assert.ok(sharedList.documents.some((doc) => doc.id === documentId));
  await collaboratorSession.request("GET", `/api/documents/${documentId}`, undefined, 200);
  await collaboratorSession.request("PATCH", `/api/documents/${documentId}`, {
    content: "<p>Edited by Bob</p>",
  }, 200);
  const edited = await ownerSession.request("GET", `/api/documents/${documentId}`, undefined, 200);
  assert.equal(edited.document.content, "<p>Edited by Bob</p>");

  await collaboratorSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: alice.email,
    role: "viewer",
  }, 403);
  await collaboratorSession.request("PATCH", `/api/documents/${documentId}/collaborators/${bobRecord.id}`, {
    role: "viewer",
  }, 403);
  await collaboratorSession.request("DELETE", `/api/documents/${documentId}/collaborators/${bobRecord.id}`, undefined, 403);

  await ownerSession.request("PATCH", `/api/documents/${documentId}/collaborators/${bobRecord.id}`, {
    role: "viewer",
  }, 200);
  await collaboratorSession.request("GET", `/api/documents/${documentId}`, undefined, 200);
  await collaboratorSession.request("PATCH", `/api/documents/${documentId}`, {
    content: "<p>Should be rejected</p>",
  }, 403);

  await ownerSession.request("POST", `/api/documents/${documentId}/collaborators`, {
    email: bob.email,
    role: "editor",
  }, 200);
  const collaborators = await ownerSession.request("GET", `/api/documents/${documentId}/collaborators`, undefined, 200);
  assert.equal(collaborators.collaborators.filter((person) => person.email === bob.email).length, 1);
  await ownerSession.request("DELETE", `/api/documents/${documentId}/collaborators/${bobRecord.id}`, undefined, 200);

  await collaboratorSession.request("GET", `/api/documents/${documentId}`, undefined, 403);
  const afterRevocation = await collaboratorSession.request("GET", "/api/documents/shared", undefined, 200);
  assert.ok(!afterRevocation.documents.some((doc) => doc.id === documentId));
  await ownerSession.request("DELETE", `/api/documents/${documentId}`, undefined, 200);
  documentId = undefined;

  console.log("SHARING INTEGRATION TESTS PASSED");
} finally {
  try {
    if (process.env.DATABASE_URL) {
      if (documentId) {
        await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);
      }
      await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [[alice.email, bob.email]]);
    }
  } finally {
    await pool.end();
  }
}
