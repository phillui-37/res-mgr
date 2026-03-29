import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { disposeApiContext } from "./fixtures/api.ts";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.e2e") });

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUTH_DIR = path.resolve(import.meta.dirname, ".auth");
const DB_PATH = path.join(
  PROJECT_ROOT,
  process.env.DATABASE_PATH ?? "db/e2e_test.sqlite3",
);
const TEST_PLUGIN_DEST = path.join(
  PROJECT_ROOT,
  "config/plugins/e2e_test_plugin.yml",
);

async function globalTeardown(): Promise<void> {
  // 1. Dispose shared API context
  await disposeApiContext();

  // 2. Remove test database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log("[e2e teardown] Removed", DB_PATH);
  }

  // 3. Remove test plugin YAML if left behind
  if (fs.existsSync(TEST_PLUGIN_DEST)) {
    fs.unlinkSync(TEST_PLUGIN_DEST);
    console.log("[e2e teardown] Removed test plugin YAML");
  }

  // 4. Clean auth state
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true });
    console.log("[e2e teardown] Cleaned auth state");
  }
}

export default globalTeardown;
