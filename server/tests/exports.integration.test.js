import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import ExcelJS from "exceljs";
import { Pool } from "pg";

config({ path: new URL("../../.env", import.meta.url) });

const apiBase = process.env.DOCSPACE_API_URL ?? "http://localhost:4000";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});
const owner = {
  name: "Export Test Owner",
  email: `export-owner-${randomUUID()}@example.test`,
  password: `Owner-${randomUUID()}!`,
};
const viewer = {
  name: "Export Test Viewer",
  email: `export-viewer-${randomUUID()}@example.test`,
  password: `Viewer-${randomUUID()}!`,
};

function createSession() {
  let cookie;
  return {
    async request(method, path, payload, expectedStatus = 200) {
      const response = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";", 1)[0];
      assert.equal(response.status, expectedStatus, `${method} ${path}`);
      return response;
    },
    async json(method, path, payload, expectedStatus = 200) {
      const response = await this.request(method, path, payload, expectedStatus);
      return response.json();
    },
  };
}

async function removeTestAccounts() {
  if (!process.env.DATABASE_URL) return;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [[owner.email, viewer.email]]);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

try {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for export integration tests");
  const ownerSession = createSession();
  const viewerSession = createSession();
  const unauthenticatedSession = createSession();

  await ownerSession.json("POST", "/api/auth/signup", owner, 201);
  await viewerSession.json("POST", "/api/auth/signup", viewer, 201);

  const ownerBefore = await ownerSession.json("GET", "/api/documents/storage");
  const viewerBefore = await viewerSession.json("GET", "/api/documents/storage");
  const richDoc = (await ownerSession.json("POST", "/api/documents", {
    title: "Export <Report>",
    type: "doc",
    content: "<h2>Quarterly report</h2><p>Text for export.</p><script>unsafe()</script>",
  }, 201)).document;
  const sheet = (await ownerSession.json("POST", "/api/documents", {
    title: "Budget",
    type: "sheet",
    content: "<table><tr><th>Item</th><th>Amount</th></tr><tr><td>Revenue</td><td>=SUM(A1:A2)</td></tr></table>",
  }, 201)).document;
  const ownerAfter = await ownerSession.json("GET", "/api/documents/storage");
  assert.equal(ownerAfter.storage.documentCount - ownerBefore.storage.documentCount, 2);
  assert.ok(ownerAfter.storage.bytes > ownerBefore.storage.bytes);
  assert.equal((await viewerSession.json("GET", "/api/documents/storage")).storage.documentCount, viewerBefore.storage.documentCount);

  await ownerSession.json("POST", `/api/documents/${richDoc.id}/collaborators`, {
    email: viewer.email,
    role: "viewer",
  }, 200);
  const viewerExport = await viewerSession.request("GET", `/api/documents/${richDoc.id}/export/txt`);
  assert.match(await viewerExport.text(), /Quarterly report/);
  await unauthenticatedSession.request("GET", `/api/documents/${richDoc.id}/export/txt`, undefined, 401);

  const richExports = [
    ["txt", "Text for export"],
    ["md", "Quarterly report"],
    ["html", "<h2>Quarterly report</h2>"],
  ];
  for (const [format, expectedText] of richExports) {
    const response = await ownerSession.request("GET", `/api/documents/${richDoc.id}/export/${format}`);
    const text = await response.text();
    assert.match(text, new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(text, /unsafe\(\)/);
    assert.match(response.headers.get("content-disposition"), new RegExp(`\\.${format}"`));
  }
  const pdfResponse = await ownerSession.request("GET", `/api/documents/${richDoc.id}/export/pdf`);
  assert.equal((await pdfResponse.arrayBuffer().then((data) => Buffer.from(data))).subarray(0, 4).toString(), "%PDF");
  const docxResponse = await ownerSession.request("GET", `/api/documents/${richDoc.id}/export/docx`);
  assert.equal((await docxResponse.arrayBuffer().then((data) => Buffer.from(data))).subarray(0, 2).toString(), "PK");

  const csv = await (await ownerSession.request("GET", `/api/documents/${sheet.id}/export/csv`)).text();
  assert.match(csv, /'=\s*SUM/);
  assert.match(csv, /"Item","Amount"/);
  const xlsxResponse = await ownerSession.request("GET", `/api/documents/${sheet.id}/export/xlsx`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await xlsxResponse.arrayBuffer()));
  assert.equal(workbook.getWorksheet("Sheet1").getCell("A1").value, "Item");
  assert.equal(workbook.getWorksheet("Sheet1").getCell("B2").value, "=SUM(A1:A2)");
  const sheetPdf = await ownerSession.request("GET", `/api/documents/${sheet.id}/export/pdf`);
  assert.equal((await sheetPdf.arrayBuffer().then((data) => Buffer.from(data))).subarray(0, 4).toString(), "%PDF");
  await ownerSession.request("GET", `/api/documents/${sheet.id}/export/docx`, undefined, 400);

  console.log("STORAGE AND EXPORT INTEGRATION TESTS PASSED");
} finally {
  try {
    await removeTestAccounts();
  } finally {
    await pool.end();
  }
}
