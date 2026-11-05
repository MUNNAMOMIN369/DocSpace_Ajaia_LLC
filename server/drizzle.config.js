const path = require("node:path");
const { config } = require("dotenv");
const { defineConfig } = require("drizzle-kit");

config({ path: path.resolve(__dirname, "../.env") });

module.exports = defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
