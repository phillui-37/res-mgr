# E2E Testing Design — res-mgr

> Date: 2026-03-29
> Scope: Full-stack browser E2E tests (frontend → backend) with WebSocket coverage
> Stack: Playwright · Podman (backend) · Vite dev server (frontend)

---

## 1. Goal

Test every user-facing flow from the browser through the React frontend to the live Ruby backend, verifying that the full stack works as a user would experience it. Coverage includes all pages, all 6 plugin types, auth flows, WebSocket events, error states, and dynamic plugin lifecycle.

---

## 2. Architecture

### 2.1 Project location

```
e2e/                          # Root-level, NOT in pnpm workspace
  package.json                # @res-mgr/e2e
  playwright.config.ts        # webServer orchestration, projects
  tsconfig.json
  .env.e2e                    # JWT_SECRET, DATABASE_URL, test API key
  global-setup.ts             # Seed DB, generate storageState
  global-teardown.ts          # Clean DB, stop containers if needed
  fixtures/
    auth.ts                   # JWT generation + storageState injection
    api.ts                    # Direct HTTP helper for test data seeding
    ws.ts                     # WebSocket client for event assertions
  seed/
    base-seed.sql             # 6 resources (one per plugin), test config
    test-plugin.yml           # Config-based plugin for dynamic plugin tests
  tests/
    auth/
      auth.spec.ts
    dashboard/
      dashboard.spec.ts
    resources/
      crud.spec.ts
      filtering.spec.ts
      detail-per-plugin.spec.ts
    progress/
      ebook-progress.spec.ts
      music-progress.spec.ts
      video-progress.spec.ts
      online-viewer-progress.spec.ts
      game-meta.spec.ts
      ws-progress-push.spec.ts
    p2p/
      rooms.spec.ts
      sharing.spec.ts
      ws-signaling.spec.ts
    plugins/
      plugin-list.spec.ts
      plugin-lifecycle.spec.ts
    settings/
      settings.spec.ts
    error/
      error-states.spec.ts
```

### 2.2 Why root-level

E2E tests span both the Ruby backend and the React frontend. Placing them at the root (sibling to `core/`, `frontend/`, `plugins/`) reflects this cross-cutting nature. The `e2e/` package has its own `package.json` and is not part of the pnpm workspace.

### 2.3 Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.52",
    "dotenv": "^16.4",
    "jsonwebtoken": "^9.0",
    "ws": "^8.18"
  }
}
```

- `@playwright/test` — browser automation + assertions + test runner
- `dotenv` — load `.env.e2e` for JWT_SECRET and config
- `jsonwebtoken` — generate JWTs matching the backend's HS256 scheme
- `ws` — raw WebSocket client for Hub and P2P signaling tests

---

## 3. Server Orchestration

### 3.1 Playwright `webServer` config

```typescript
// playwright.config.ts (conceptual)
export default defineConfig({
  webServer: [
    {
      command: "bin/dev",
      port: 3000,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        RACK_ENV: "test",
        DATABASE_URL: "sqlite://db/e2e_test.sqlite3",
        JWT_SECRET: process.env.JWT_SECRET,
      },
    },
    {
      command: "cd frontend && pnpm dev:web",
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: "http://localhost:5173",
  },
});
```

- Backend starts via `bin/dev` (podman compose) on port 3000
- Frontend starts via `pnpm dev:web` on port 5173 (Vite proxies `/api` → `:3000`)
- `reuseExistingServer: true` allows running against already-started services for fast iteration
- Backend uses a dedicated `e2e_test.sqlite3` database (not the dev or test DB)

**Prerequisite fix:** The Vite proxy currently targets port 9292 (`vite.config.ts` line 14-15) but the backend listens on port 3000 (puma.rb default, docker-compose port mapping). Before E2E tests work, update `vite.config.ts`:
```typescript
"/api": { target: "http://localhost:3000", ... },
"/ws":  { target: "ws://localhost:3000", ws: true },
```

### 3.2 Global setup / teardown

**`global-setup.ts`:**
1. Wait for backend health: `GET http://localhost:3000/health`
2. Load `seed/base-seed.sql` via podman exec: `podman compose exec dev sqlite3 db/e2e_test.sqlite3`
3. Generate authenticated `storageState.json` with JWT + apiUrl in localStorage

**`global-teardown.ts`:**
1. Delete `db/e2e_test.sqlite3` (or truncate tables)
2. Remove any test plugin files copied during tests

---

## 4. Auth Strategy

### 4.1 JWT generation

The backend validates JWTs with HS256 using `JWT_SECRET`. E2E tests share the same secret (from `.env.e2e`) and generate tokens using the `jsonwebtoken` npm package:

```typescript
// fixtures/auth.ts
import jwt from "jsonwebtoken";

export function generateJwt(sub = "e2e-test-user", expiresIn = "1h") {
  return jwt.sign({ sub }, process.env.JWT_SECRET!, { algorithm: "HS256", expiresIn });
}
```

### 4.2 Storage state injection

Playwright's `storageState` feature injects `localStorage` before page load:

```typescript
// global-setup.ts generates storageState.json:
{
  "origins": [{
    "origin": "http://localhost:5173",
    "localStorage": [
      { "name": "jwt", "value": "<generated-token>" },
      { "name": "apiUrl", "value": "http://localhost:3000" }
    ]
  }]
}
```

All tests use this by default. Unauthenticated tests use a separate project with empty storage state.

### 4.3 API key auth

For programmatic API seeding (fixture `api.ts`), tests use `X-API-Key` header with a key defined in the test config. This avoids JWT expiry issues during long test runs.

---

## 5. Fixtures

### 5.1 `fixtures/auth.ts`

Playwright custom fixture that extends `test`:
- `authenticatedPage` — page with JWT pre-injected
- `unauthenticatedPage` — page with empty storage
- `generateJwt(sub, expiresIn)` — token factory

### 5.2 `fixtures/api.ts`

Direct HTTP client (using Playwright's `request` context) for test data setup:
- `createResource(data)` → POST /resources
- `createRoom(roomId?)` → POST /p2p/rooms
- `saveProgress(plugin, id, data)` → POST /resources/:plugin/:id/progress
- `shareResource(roomId, resourceId)` → POST /p2p/rooms/:id/share
- `seedResources(count, plugin)` → bulk create for pagination tests

All calls use `X-API-Key` header. This fixture is used in `test.beforeEach()` to create test-specific data.

### 5.3 `fixtures/ws.ts`

Raw WebSocket helper using the `ws` npm package:
- `connectHub(topics)` → connect to `ws://localhost:3000/ws?topics=...&token=<jwt>`
- `connectP2P(roomId)` → connect to `ws://localhost:3000/ws/p2p?room=...&token=<jwt>`
- `waitForMessage(type, timeout)` → promise that resolves when a message of the given type arrives
- `send(message)` → send JSON message
- `close()` → clean disconnect

Used in progress push tests and P2P signaling tests.

---

## 6. Seed Data

### 6.1 `seed/base-seed.sql`

Inserts minimal shared data:

```sql
-- One resource per plugin type
INSERT INTO resources (name, type, plugin, locations, tags, active)
VALUES
  ('test-ebook.epub',    'ebook',         'ebook',         '["file:///books/test.epub"]',    '[]', 1),
  ('test-track.mp3',     'audio',         'music',         '["file:///music/test.mp3"]',     '[]', 1),
  ('test-video.mp4',     'video',         'video',         '["file:///video/test.mp4"]',     '[]', 1),
  ('test-game',          'game',          'game',          '["C:\\Games\\test"]',             '[]', 1),
  ('test-gallery.zip',   'image_archive', 'pic',           '["file:///pics/gallery.zip"]',   '[]', 1),
  ('test-manga',         'online_manga',  'online_viewer', '["https://example.com/manga"]',  '[]', 1);
```

Plugin schema tables (ebook_progress, music_progress, etc.) are auto-created by the boot sequence when plugins load.

### 6.2 `seed/test-plugin.yml`

A minimal config-based plugin definition for the dynamic plugin lifecycle test:

```yaml
name: e2e_test_plugin
version: "1.0.0"
capabilities:
  - inventory
schema:
  table: e2e_test_meta
  columns:
    resource_id: { type: integer, null: false }
    test_field: { type: string }
```

Copied into `config/plugins/` during the plugin lifecycle test, then removed in teardown.

---

## 7. Test Scenarios

### 7.1 Auth (4 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Unauthenticated redirect | Visit `/resources` with no JWT | Redirected to `/settings` |
| Set JWT in settings | Enter token + URL, save | Subsequent navigation loads data |
| Invalid JWT | Inject expired token, visit page | 401 → redirect to `/settings` |
| API key auth | Programmatic request with X-API-Key | 200 response |

### 7.2 Dashboard (2 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Renders resource counts | Visit `/` | Shows count per plugin type from seed data |
| Navigation links | Click plugin card | Navigates to filtered resource list |

### 7.3 Resources CRUD (8 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| List shows resources | Visit `/resources` | Seed resources visible |
| Pagination | Seed 60 resources, navigate pages | Page 2 shows different items, headers correct |
| Filter by plugin | Select "music" filter | Only music resources shown |
| Filter by name | Type "ebook" in search | Filtered results |
| Create resource | Fill form at `/resources/new`, submit | Redirected to detail, appears in list |
| View detail | Click resource in list | Detail page renders name, plugin badge, locations |
| Edit resource | Change name on detail page | Updated name shown |
| Delete resource | Click delete | Removed from list (soft-delete) |

### 7.4 Progress per plugin (10 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Ebook progress | Save { current_page: 42, total_pages: 300, percentage: 14.0 } | ProgressPanel shows "Page 42 / 300" and 14.0% bar |
| Music progress | Save { position_ms: 125000, duration_ms: 240000 } | Panel shows "2:05 / 4:00" |
| Video progress | Save { position_ms: 3600000, duration_ms: 7200000 } | Panel shows "60:00 / 120:00" |
| Online viewer progress | Save { progress_pct: 75, last_page: "ch-12" } via API | Data retrievable via GET |
| Game meta | Save { launcher: "steam", steam_app_id: "12345" } | Detail page shows meta |
| Game launch-ping | POST launch-ping | last_played_at updated |
| Progress panel latest | Save 2 records for different devices | Panel shows most recent |
| WS progress push (music) | Subscribe to `progress/music/:id`, save progress via API | WS receives event with position_ms |
| WS progress push (ebook) | Subscribe to `progress/ebook/:id`, save progress via API | WS receives event with percentage |
| Pic meta | Save { image_count: 42, cover_path: "/cover.jpg" } | Data persists |

### 7.5 P2P Rooms (6 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Create room | Click create on `/p2p` | New room appears in list |
| Room detail | Navigate to room detail | Shows peer count, shared resources |
| Share resource | Share a resource into room | Appears in room detail |
| Revoke resource | Revoke shared resource | Removed from room detail |
| WS join room | Connect WS to `/ws/p2p?room=X` | Receive `joined` with peer list |
| WS peer joined | Second WS client joins same room | First client receives `peer_joined` |

### 7.6 Plugins (7 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| List plugins | Visit plugins page (if any) or call API | All 6 plugins returned |
| Plugin detail | GET /plugins/ebook | Returns version + capabilities |
| Plugin reload | POST /plugins/ebook/reload | Returns { reloaded: true, version } |
| Deploy new plugin | Copy test-plugin.yml → config/plugins/, reload | New plugin appears in GET /plugins |
| New plugin routes | GET /resources/e2e_test_plugin | Returns 200 (empty list) |
| New plugin schema | Create resource for new plugin, save meta | Data persists in e2e_test_meta table |
| Unload plugin | Remove YAML, reload | Plugin gone from list, routes return 404 |

### 7.7 Settings (3 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Save JWT | Enter token, save | Token persisted; page reload preserves auth |
| Save API URL | Change URL, save | Subsequent requests use new base URL |
| Logout | Click logout | JWT cleared, redirected to settings |

### 7.8 Error handling (4 tests)

| Test | Action | Assertion |
|------|--------|-----------|
| Invalid route | Navigate to `/nonexistent` | 404 or fallback page |
| Backend 500 | Mock/force server error | Error state shown on page |
| Network timeout | Block API response | Loading/error state rendered |
| Validation error | Create resource with missing name | Error message displayed |

### Total: 44 test cases across 8 categories.

---

## 8. Playwright Config Details

### 8.1 Projects

```typescript
projects: [
  {
    name: "authenticated",
    use: { storageState: "e2e/.auth/storageState.json" },
  },
  {
    name: "unauthenticated",
    use: { storageState: { cookies: [], origins: [] } },
    testMatch: /auth\/.*/,
  },
],
```

Most tests run as "authenticated" (pre-injected JWT). The `auth/` tests have a separate project for unauthenticated scenarios.

### 8.2 Timeouts

- Test timeout: 30s (most UI tests finish in <5s)
- WebServer startup timeout: 60s (podman may need to pull images)
- WebSocket message timeout: 10s
- Expect timeout: 5s

### 8.3 Retries and parallelism

- Retries: 1 on CI, 0 locally
- Workers: 1 (tests share the same DB; parallelism would require DB isolation per worker)
- Serial execution within each spec file

### 8.4 Reporters

- `html` for local review
- `list` for terminal output
- `junit` for CI integration

---

## 9. Run Commands

```bash
# Full suite (auto-starts servers)
cd e2e && npx playwright test

# Specific category
cd e2e && npx playwright test tests/resources/

# Against already-running servers (faster iteration)
cd e2e && npx playwright test --no-webserver

# Headed mode (see the browser)
cd e2e && npx playwright test --headed

# Debug a single test
cd e2e && npx playwright test tests/auth/auth.spec.ts --debug
```

Convenience script at `bin/e2e`:
```bash
#!/bin/bash
cd "$(dirname "$0")/../e2e" && npx playwright test "$@"
```

---

## 10. CI Integration

Not in initial scope, but the design supports it:
- `webServer` entries start backend (podman) and frontend
- `junit` reporter outputs XML for CI ingestion
- Future: GitHub Actions workflow with `playwright.yml`

---

## 11. Constraints and Limitations

- **Single worker**: Tests run serially because they share one database. Parallel execution would require per-worker DB isolation (future enhancement).
- **No login page**: The app has no `/login` endpoint. Auth is handled by injecting JWTs into localStorage. This is realistic for the app's design (external JWT provider), but means we can't test a "real" login flow.
- **Plugin lifecycle tests are destructive**: Copying/removing plugin files from `config/plugins/` modifies the filesystem. These tests must clean up reliably (handled in `afterAll`).
- **WebSocket tests use raw `ws` client, not the browser**: Testing WS events through the browser would require the frontend to expose subscription state, which adds test-only code. Using `ws` directly is more reliable and avoids coupling.
- **Podman startup time**: First run may take 30-60s to pull/build containers. Subsequent runs reuse them.
