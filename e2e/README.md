# E2E Tests

End-to-end test suite for res-mgr-server-rb using [Playwright](https://playwright.dev/).

## Overview

49 tests across 19 spec files covering the full application stack — backend API, frontend UI, WebSocket real-time features, and plugin system.

| Category          | Tests | Spec Files                                    |
|-------------------|-------|-----------------------------------------------|
| Auth flows        | 4     | `auth/auth.spec.ts`                           |
| Dashboard         | 2     | `dashboard/dashboard.spec.ts`                 |
| Settings          | 3     | `settings/settings.spec.ts`                   |
| Error states      | 4     | `error/error-states.spec.ts`                  |
| Resource CRUD     | 6     | `resources/crud.spec.ts`                      |
| Filtering         | 2     | `resources/filtering.spec.ts`                 |
| Detail per plugin | 6     | `resources/detail-per-plugin.spec.ts`         |
| Progress tracking | 7     | `progress/ebook-progress.spec.ts`, etc.       |
| WS progress       | 2     | `progress/ws-progress-push.spec.ts`           |
| P2P rooms         | 2     | `p2p/rooms.spec.ts`                           |
| P2P sharing       | 2     | `p2p/sharing.spec.ts`                         |
| WS signaling      | 2     | `p2p/ws-signaling.spec.ts`                    |
| Plugin listing    | 3     | `plugins/plugin-list.spec.ts`                 |
| Plugin lifecycle  | 4     | `plugins/plugin-lifecycle.spec.ts`            |

## Prerequisites

- **Node.js 22+** (for `import.meta.dirname` support)
- **Backend running** on port 3000
- **Frontend dev server** on port 5173
- **Chromium** (installed via Playwright)

## Quick Start

```bash
# Install dependencies + Chromium
bin/e2e --install

# Run all tests
bin/e2e

# Run with visible browser
bin/e2e --headed

# Open interactive Playwright UI
bin/e2e --ui

# Debug with Playwright Inspector
bin/e2e --debug

# Run specific test file
bin/e2e tests/auth/

# Run specific test by name
bin/e2e --grep "create resource"
```

## Architecture

### Test Projects

Playwright is configured with two projects:

| Project           | Auth State           | Test Pattern         |
|-------------------|----------------------|----------------------|
| `authenticated`   | JWT in localStorage  | All except `auth/*`  |
| `unauthenticated` | Empty state          | `auth/*.spec.ts`     |

### Execution Model

Tests run **serially** (`workers: 1`) because they share a single SQLite database. This prevents race conditions between tests that create/modify resources.

### Web Servers

Playwright auto-starts both servers:

1. **Backend** (port 3000): `cd .. && bin/dev` with `RACK_ENV=test` and test SQLite DB
2. **Frontend** (port 5173): `cd ../frontend && pnpm --filter @res-mgr/web dev`

### Global Setup / Teardown

**Setup** (`global-setup.ts`):
1. Waits for backend health endpoint (`/health`)
2. Seeds database via `sqlite3` CLI with `seed/base-seed.sql`
3. Generates JWT token and writes `storageState.json` for authenticated tests

**Teardown** (`global-teardown.ts`):
1. Disposes shared API context
2. Removes test database file
3. Cleans up test plugin YAML (if created)
4. Removes auth state directory

## Directory Structure

```
e2e/
├── .env.e2e                 # Test environment variables
├── playwright.config.ts     # Playwright configuration
├── global-setup.ts          # DB seeding + auth state
├── global-teardown.ts       # Cleanup
├── tsconfig.json            # TypeScript config (ESM, noEmit)
├── fixtures/
│   ├── auth.ts              # JWT generation, storageState builder
│   ├── api.ts               # HTTP helpers (createResource, saveProgress, etc.)
│   └── ws.ts                # WebSocket client (hub + P2P)
├── seed/
│   ├── base-seed.sql        # 6 seed resources (one per plugin)
│   └── test-plugin.yml      # Config plugin for lifecycle tests
└── tests/
    ├── auth/                # Authentication flow tests
    ├── dashboard/           # Dashboard rendering tests
    ├── settings/            # Settings page tests
    ├── error/               # Error state tests
    ├── resources/           # Resource CRUD, filtering, detail tests
    ├── progress/            # Progress tracking per plugin + WebSocket
    ├── p2p/                 # P2P rooms, sharing, signaling tests
    └── plugins/             # Plugin listing + lifecycle tests
```

## Fixtures

### `auth.ts` — Authentication

```typescript
import { generateJwt } from "../fixtures/auth.ts";

// Generate a JWT for test user (2h expiry)
const token = generateJwt("test-user", "2h");

// Build Playwright storageState with JWT + API URL in localStorage
const state = buildStorageState(token, "http://localhost:3000");
```

### `api.ts` — HTTP Helpers

```typescript
import { createResource, saveProgress, createRoom, shareResource } from "../fixtures/api.ts";

// Create a resource
const resource = await createResource({
  name: "my-book",
  plugin: "ebook",
  locations: ["file:///books/my-book.epub"],
});

// Save progress
await saveProgress("ebook", resource.id, {
  device: "browser",
  current_page: 42,
  total_pages: 300,
  percentage: 14.0,
});

// Create P2P room
const room = await createRoom("my-room");

// Share resource into room
await shareResource(room.room_id, resource.id);
```

### `ws.ts` — WebSocket Client

```typescript
import { connectHub, connectP2P } from "../fixtures/ws.ts";

// Subscribe to hub topics
const hub = await connectHub(["progress/ebook/1"]);
const msg = await hub.waitForMessage("progress", 10_000);
await hub.close();

// Connect to P2P signaling
const peer = await connectP2P("room-id", "peer-1");
peer.send({ type: "join", room: "room-id" });
const joined = await peer.waitForMessage("joined", 10_000);
await peer.close();
```

## Environment Variables

Defined in `.env.e2e`:

| Variable        | Default                  | Description                  |
|-----------------|--------------------------|------------------------------|
| `JWT_SECRET`    | `changeme`               | JWT signing secret           |
| `API_KEY`       | `e2e-test-api-key-...`   | API key for key-based auth   |
| `BACKEND_URL`   | `http://localhost:3000`  | Backend server URL           |
| `FRONTEND_URL`  | `http://localhost:5173`  | Frontend dev server URL      |
| `DATABASE_PATH` | `db/e2e_test.sqlite3`    | Path to test SQLite database |

## Seed Data

`seed/base-seed.sql` creates 6 resources (one per plugin type):

| Name                  | Plugin         | Location                           |
|-----------------------|----------------|------------------------------------|
| `test-ebook.epub`     | ebook          | `file:///test/books/test.epub`     |
| `test-track.mp3`      | music          | `file:///test/music/test.mp3`      |
| `test-video.mp4`      | video          | `file:///test/video/test.mp4`      |
| `test-game`           | game           | `C:\Games\test`                    |
| `test-pic.zip`        | pic            | `file:///test/pics/test.zip`       |
| `test-viewer`         | online_viewer  | `https://example.com/test`         |

## Writing New Tests

### 1. Create a spec file

```typescript
// tests/my-feature/my-test.spec.ts
import { test, expect } from "@playwright/test";
import { createResource } from "../../fixtures/api.ts";

test.describe("My feature", () => {
  test("does something", async ({ page }) => {
    // Seed test data via API
    const r = await createResource({
      name: "test-resource",
      plugin: "ebook",
      locations: ["file:///test.epub"],
    });

    // Navigate and assert
    await page.goto(`/resources/ebook/${r.id}`);
    await expect(page.getByText("test-resource")).toBeVisible();
  });
});
```

### 2. For unauthenticated tests

Place specs in `tests/auth/` — the `unauthenticated` project only matches `auth/*.spec.ts`.

### 3. For WebSocket tests

Use the `ws.ts` fixture directly (not browser WebSocket):

```typescript
import { connectHub } from "../../fixtures/ws.ts";

test("receives event", async () => {
  const client = await connectHub(["my-topic"]);
  try {
    // Trigger event via API...
    const msg = await client.waitForMessage("my-event", 10_000);
    expect(msg).toMatchObject({ type: "my-event" });
  } finally {
    await client.close();
  }
});
```

### 4. TypeScript imports

Use `.ts` extensions in all imports (ESM requirement):

```typescript
// ✅ Correct
import { createResource } from "../../fixtures/api.ts";

// ❌ Wrong
import { createResource } from "../../fixtures/api";
```

## Troubleshooting

### Tests fail with "connect ECONNREFUSED"

Backend isn't running. Start it manually or let Playwright handle it:
```bash
bin/dev  # In terminal 1
bin/e2e  # In terminal 2
```

### "storageState.json not found"

Global setup failed. Check that the backend health endpoint responds:
```bash
curl http://localhost:3000/health
```

### TypeScript errors

Run the type checker:
```bash
cd e2e && npx tsc --noEmit
```

### View test report after failure

```bash
cd e2e && npx playwright show-report
```
