import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateJwt, buildStorageState } from "./fixtures/auth.ts";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.e2e") });

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUTH_DIR = path.resolve(import.meta.dirname, ".auth");
const SEED_SQL = path.resolve(import.meta.dirname, "seed/base-seed.sql");
const DB_PATH = path.join(
  PROJECT_ROOT,
  process.env.DATABASE_PATH ?? "db/e2e_test.sqlite3",
);

async function waitForBackend(
  url: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Backend not ready after ${timeoutMs}ms`);
}

async function globalSetup(): Promise<void> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

  // 1. Wait for backend health
  console.log("[e2e setup] Waiting for backend at", backendUrl);
  await waitForBackend(`${backendUrl}/health`);
  console.log("[e2e setup] Backend is ready");

  // 2. Seed the database
  if (fs.existsSync(SEED_SQL)) {
    console.log("[e2e setup] Seeding database...");
    const sql = fs.readFileSync(SEED_SQL, "utf-8");
    try {
      execSync(`sqlite3 "${DB_PATH}"`, {
        input: sql,
        cwd: PROJECT_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log("[e2e setup] Database seeded");
    } catch (e) {
      console.warn("[e2e setup] Seed may have already been applied:", (e as Error).message);
    }
  }

  // 3. Generate authenticated storageState
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const token = generateJwt("e2e-test-user", "2h");
  const state = buildStorageState(token);
  fs.writeFileSync(
    path.join(AUTH_DIR, "storageState.json"),
    JSON.stringify(state, null, 2),
  );
  console.log("[e2e setup] storageState.json written");
}

export default globalSetup;
