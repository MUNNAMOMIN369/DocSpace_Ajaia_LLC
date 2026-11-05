import { verifyDatabaseConnection } from "../db/index.js";

async function main() {
  try {
    await verifyDatabaseConnection();
    console.log("Database connection verified successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Database verification failed.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

void main();
