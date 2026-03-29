import { test as base, type Page } from "@playwright/test";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

export function generateJwt(
  sub = "e2e-test-user",
  expiresIn = "1h",
): string {
  return jwt.sign({ sub }, JWT_SECRET, {
    algorithm: "HS256" as const,
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function buildStorageState(token: string) {
  return {
    cookies: [] as never[],
    origins: [
      {
        origin: FRONTEND_URL,
        localStorage: [
          { name: "jwt", value: token },
          { name: "apiUrl", value: BACKEND_URL },
        ],
      },
    ],
  };
}

type AuthFixtures = {
  authedPage: Page;
  unauthedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use) => {
    const token = generateJwt();
    const context = await browser.newContext({
      storageState: buildStorageState(token),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  unauthedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
