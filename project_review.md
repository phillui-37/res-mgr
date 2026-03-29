# Full-Stack Architecture Review — res-mgr

> Reviewed: 2026-03-29
> Scope: Backend (Ruby/Roda) + Frontend (React/Electron)
> Stack: Ruby 3.4 · Roda · Sequel · React 19 · Vite 8 · Electron 41 · pnpm workspaces
> Reviewer: architecture-auditor (Claude Opus 4.6)

---

## Executive Summary

This is a **resource-management monorepo** with a Ruby backend (`core/`, `plugins/`) and a
React/Electron frontend (`frontend/packages/web`, `frontend/packages/electron`). The backend
is well-structured with a clean plugin architecture, centralised auth, and 208 passing tests.
The frontend is a fresh scaffold with correct separation (API layer → stores → pages →
components) but is not yet battle-tested.

**Strengths:**
- Backend plugin architecture is genuinely extensible
- Boot sequence has no circular dependencies
- Workspace monorepo separates web/electron correctly
- TanStack Query + Zustand is a solid frontend state stack

**Critical issues found:**
1. **API contract mismatches** between frontend types and backend response shapes (5 issues)
2. **Plugin isolation violation** — all 6 plugins hard-call global singletons
3. **Frontend auth store is disconnected from the API client** (`apiUrl` is set but not consumed)
4. **Resource type drift** — frontend expects `meta`, `locations`, `created_at`; backend sends
   `tags`, `checksum`, `active` with different shape

---

## §1 — API Contract Mismatches (P0 Critical)

The frontend types in `packages/web/src/types/index.ts` do not match what the backend actually
returns. This will cause runtime failures the moment the frontend connects to a real backend.

### 1.1 Resource shape mismatch

**Frontend type:**
```typescript
interface Resource {
  id: number; name: string; type: string; plugin: PluginName;
  locations: string[];
  meta: Record<string, unknown>;  // ← does not exist in backend
  created_at: string; updated_at: string;
}
```

**Backend `to_api_h`** (`core/inventory/resource.rb:37-49`):
```ruby
{ id:, name:, type:, plugin:, locations:,
  tags:,       # ← not in frontend type
  checksum:,   # ← not in frontend type
  active:,     # ← not in frontend type
  created_at:, updated_at: }
```

**Missing in frontend:** `tags`, `checksum`, `active`
**Phantom in frontend:** `meta` — this field does not exist in the database or model.

### 1.2 Progress record field names differ per plugin

**Frontend expects one universal `ProgressRecord`:**
```typescript
interface ProgressRecord {
  position_seconds?: number;
  duration_seconds?: number;
  percentage?: number;
  current_page?: number;
}
```

**Backend actually sends** (per-plugin):

| Plugin         | Time field       | Unit         | Percentage field |
|----------------|------------------|--------------|------------------|
| `music`        | `position_ms`    | milliseconds | —                |
| `video`        | `position_ms`    | milliseconds | —                |
| `ebook`        | —                | —            | `percentage`     |
| `online_viewer`| —                | —            | `progress_pct`   |

The frontend renders `position_seconds` in the `ProgressPanel` component (line 57–59), but the
backend sends `position_ms`. The math `Math.floor(position_seconds / 60)` will produce wildly
wrong results (off by factor of 1000).

`online_viewer` sends `progress_pct` and `last_page`, but the frontend type expects
`percentage` and `current_page`.

### 1.3 P2P create response is incomplete

**Frontend expects** from `createRoom()`:
```typescript
{ room_id: string; ws_url: string }
```

**Backend returns** (`core/p2p_controller.rb:44`):
```ruby
{ room_id:, ws_url: "/ws/p2p?room=#{room_id}" }
```

This is correct for the create endpoint. But `P2PRoomsPage.tsx` immediately queries the rooms
list after creation, which expects `peer_count` and `shared_resources` — these are only returned
by the `room_info` endpoint, not by `list_rooms`. The `GET /p2p/rooms` endpoint
(`p2p_controller.rb:35`) calls `rooms_summary` which returns `{ room_id:, peer_count: }` —
no `shared_resources` array. The frontend type says it's always present.

### 1.4 Capabilities type serialisation

Backend plugins declare `capabilities` as Ruby symbols (`%i[inventory viewer progress]`).
`Oj.dump` serialises symbols as strings, so this works. But the contract is implicit — if
any plugin returns capabilities as strings (valid Ruby), the JSON output changes.

**Recommendation:** Add an explicit `.map(&:to_s)` in `BasePlugin#to_h` to guarantee strings.

---

## §2 — Frontend Auth/Client Disconnect (P0 Critical)

### 2.1 `apiUrl` store state is ignored by the HTTP client

`store/auth.ts` stores `apiUrl` with a default of `"http://localhost:9292"`.
`SettingsPage.tsx` calls `http.defaults.baseURL = url` when the user saves.

**But** `api/client.ts` creates the axios instance at module load time:
```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
export const http = axios.create({ baseURL: BASE_URL });
```

This means:
1. On page load, `http.baseURL` is always `/api` (or the env var), NOT the stored `apiUrl`.
2. The user's saved `apiUrl` is only applied after they visit Settings and click Save.
3. On page refresh, it resets.

The `useAuthStore` persist middleware saves `apiUrl` to localStorage, but nothing reads it back
into the axios client on startup.

### 2.2 Dual JWT storage

`setJwt()` does **both** `localStorage.setItem("jwt", jwt)` AND `set({ jwt })`.
The interceptor in `client.ts` reads from `localStorage.getItem("jwt")`, not from Zustand.
The Zustand `persist` middleware ALSO writes to localStorage under key `"res-mgr-auth"`.

This creates two separate localStorage keys storing the JWT:
- `localStorage["jwt"]` — written by `setJwt()`, read by interceptor
- `localStorage["res-mgr-auth"]` — written by Zustand persist, includes jwt in its JSON

If one is cleared but not the other, behaviour becomes inconsistent.

---

## §3 — Plugin Isolation (P1 High)

### 3.1 Plugins directly access global singletons

Every plugin file-requires nothing but inherits from `BasePlugin`. Yet all 6 plugin
implementations call `DB.connection`, and 4 call `Websocket::Hub.instance.publish`:

```
plugins/ebook/plugin.rb         → DB.connection[:ebook_progress]
                                → Websocket::Hub.instance.publish
plugins/music/plugin.rb         → DB.connection[:music_progress]
                                → Websocket::Hub.instance.publish
plugins/video/plugin.rb         → DB.connection[:video_progress]
                                → Websocket::Hub.instance.publish
plugins/online_viewer/plugin.rb → DB.connection[:online_viewer_sessions]
                                → Websocket::Hub.instance.publish
plugins/game/plugin.rb          → DB.connection[:game_meta]
                                → extend ControllerHelpers  (core module)
plugins/pic/plugin.rb           → DB.connection[:pic_meta]
```

**Impact:**
- Plugins cannot be tested in isolation (must boot the full app or mock globals)
- A plugin crash in DB access can bring down the entire app
- No plugin sandboxing — a malicious/buggy plugin has full DB access to all tables

**Recommendation:** Inject a `PluginContext` object into plugin route methods:
```ruby
class PluginContext
  attr_reader :db, :hub, :config
  def initialize(db:, hub:, config:) = (@db, @hub, @config = db, hub, config)
end
```

### 3.2 Game plugin extends core module

`plugins/game/plugin.rb:7` has `extend ControllerHelpers`. This creates a compile-time
dependency from a plugin to a core module. Plugins should only depend on `BasePlugin`.

---

## §4 — Backend Architecture

### 4.1 No circular dependencies ✅

The `core/boot.rb` require chain is strictly linear:
```
boot.rb → config → app_logger → db → base_plugin → plugin_schema
       → plugin_registry → plugin_loader → plugin_hot_reload
       → authenticator → controller_helpers → request_logger
       → auth_middleware → websocket/* → controllers → app
```

No file requires something that was already loaded. This is a genuine strength.

### 4.2 Controllers are static singletons

All controllers use `class << self` with class-level methods. This means:
- No instance state → no constructor injection
- Every method receives `r` (the Roda request) as a parameter instead of using instance state
- Testing requires mocking global singletons (`DB.connection`, `PluginRegistry.instance`)

This is acceptable for the project's current scale but becomes a liability if controllers
grow. The lack of instance state means you cannot swap dependencies per-request.

### 4.3 SQL injection risk in name search

`core/inventory/resource_controller.rb:47`:
```ruby
ds = ds.where(Sequel.like(:name, "%#{r.params['name']}%"))
```

`r.params['name']` is user input interpolated into a LIKE pattern. While Sequel parameterises
the SQL (preventing true SQL injection), the `%` and `_` characters in user input act as
wildcards. A search for `%` returns all resources.

**Recommendation:** Escape LIKE wildcards:
```ruby
escaped = r.params['name'].gsub(/[%_\\]/) { |c| "\\#{c}" }
ds = ds.where(Sequel.like(:name, "%#{escaped}%"))
```

### 4.4 Error handling inconsistency

The project uses 4 different error-signalling patterns:
1. `halt!(status, msg)` — controllers (14 uses)
2. `raise ArgumentError` — plugin registry validation (3 uses)
3. `raise "string"` — boot.rb JWT guard (1 use)
4. `rescue StandardError => e` — generic catch-all (6 uses)

The generic `rescue StandardError` in `plugin_loader/file.rb:51` and `config.rb:51` swallows
load errors silently (only logs). A plugin that fails to load does not surface to the API.

**Recommendation:** Add a `GET /health` field that reports plugin load failures, or raise
after logging so the boot sequence halts on critical failures.

### 4.5 Hot reload uses $LOADED_FEATURES mutation

`core/plugin_hot_reload.rb` manipulates `$LOADED_FEATURES` to force re-require of plugin
files. This is a global Ruby interpreter mutation that can cause subtle bugs if any gem
caches require state. It works for development but should be disabled in production via
a config guard.

---

## §5 — Frontend Architecture

### 5.1 Workspace structure is correct ✅

```
frontend/
  pnpm-workspace.yaml
  packages/
    web/      → @res-mgr/web   (standalone SPA)
    electron/ → @res-mgr/electron (wraps web as extraResource)
```

The web package has zero dependency on Electron. The electron package depends on
`@res-mgr/web: workspace:*` and bundles `web/dist` as `extraResources`. This is the
correct separation.

### 5.2 Component data flow is clean ✅

```
Page → useQuery()/useMutation() → api layer → axios client → interceptors
Page → useXxxStore() → Zustand
Page → renders <UIComponent /> (no API calls in components)
```

No UI component (`Badge`, `Button`, `Input`, `Spinner`, `AudioPlayer`, etc.) imports from the
API layer. Data fetching happens exclusively in page components via TanStack Query.

### 5.3 Missing custom hooks

Pages directly call `useQuery({ queryKey: [...], queryFn: () => resourcesApi.list(filter) })`.
This works but creates coupling between page components and the query key schema.

**Recommendation:** Extract hooks:
```typescript
// hooks/useResources.ts
export function useResources(filter: ResourceFilter) {
  return useQuery({ queryKey: ["resources", filter], queryFn: () => resourcesApi.list(filter) });
}
```

This centralises cache invalidation keys and makes them refactorable.

### 5.4 No error boundaries

The app has no React error boundaries. A runtime error in any component (e.g., `ProgressPanel`
trying to access `position_seconds` on undefined) crashes the entire page.

**Recommendation:** Add `<ErrorBoundary>` around `<Outlet />` in `AppLayout.tsx`.

### 5.5 No loading/error states in some pages

`P2PRoomDetailPage.tsx` checks `if (!room) return <div>Room not found.</div>` but doesn't
handle the query error state. If the network is down, it shows nothing. All pages should
handle `isError` from `useQuery`.

### 5.6 Tailwind bundle size

The production build is 675 KB (209 KB gzipped) in a single chunk. For an app of this
complexity, that's large. Vite reports a code-splitting suggestion.

**Recommendation:** Add route-based lazy loading:
```typescript
const ResourceListPage = lazy(() => import("./pages/resources/ResourceListPage"));
```

---

## §6 — Electron Package

### 6.1 WebSocket URL relative path issue

Backend returns `ws_url: "/ws/p2p?room=#{room_id}"`. When running in Electron with a remote
backend (e.g., `http://my-nas:9292`), this relative path resolves to
`http://my-nas:9292/ws/p2p?room=...` — which may work. But if the Vite proxy is involved
(`/api` → `:9292`), the WebSocket path `/ws` doesn't go through the proxy.

**Recommendation:** Return absolute WebSocket URLs from the backend:
```ruby
ws_url: "#{request.base_url.sub('http', 'ws')}/ws/p2p?room=#{room_id}"
```

### 6.2 No IPC handlers registered

`preload.cjs` exposes `launchMoonlight()` and `openWebView()` via `contextBridge`, both calling
`ipcRenderer.invoke(...)`. But `main.cjs` never registers `ipcMain.handle(...)` for these
channels. Calling them will throw "No handler registered for 'launch-moonlight'".

**Recommendation:** Add handlers in `main.cjs`:
```javascript
const { ipcMain, shell } = require("electron");
ipcMain.handle("launch-moonlight", (_, { host, appName }) => { /* ... */ });
ipcMain.handle("open-webview", (_, { url, title }) => { /* new BrowserWindow */ });
```

### 6.3 No `wait-on` installed

`packages/electron/package.json` lists `wait-on` in devDependencies, but check if it resolved
in the lockfile. The `dev` script depends on it: `wait-on http://localhost:5173 && electron .`.

---

## §7 — Testing Gaps

### 7.1 Backend: 208 tests, solid coverage ✅

The backend test suite covers:
- All CRUD operations (resources, plugins, P2P rooms)
- Auth middleware (JWT + API key)
- Plugin registry (validation, register, unregister)
- Plugin schema migrations
- Pagination headers
- Plugin sub-routes (routing bug regression tests)
- P2PSignaling public API
- ControllerHelpers and Authenticator modules

### 7.2 Frontend: 0 tests ❌

No test files exist in `packages/web/src/__tests__/`. Vitest is configured but no specs have
been written yet. The API layer, stores, and utility functions are all testable without a DOM.

**Priority test targets:**
1. `api/client.ts` — JWT interceptor, 401 redirect
2. `api/resources.ts` — pagination header parsing (`parsePagination`)
3. `store/auth.ts` — JWT persistence, logout
4. `store/resources.ts` — filter merge, reset
5. `api/p2p.ts`, `api/plugins.ts` — request construction

---

## §8 — Cross-Cutting Concerns

### 8.1 No shared types between backend and frontend

The frontend types are hand-maintained in `types/index.ts` and already drift from the backend.
There is no mechanism to keep them in sync (no OpenAPI spec, no JSON schema, no code
generation).

**Recommendation:** Add a `GET /schema` endpoint that returns the expected response shapes
as JSON Schema, or generate TypeScript types from the backend model definitions.

### 8.2 No CORS configuration

The backend has no CORS middleware. When deployed to a different origin than the frontend,
all API requests will fail. This is currently hidden because the Vite dev server proxies `/api`.

**Recommendation:** Add `rack-cors` to the Gemfile and configure it in `config.ru`.

### 8.3 No request rate limiting

All endpoints are unprotected against brute-force or abuse. The JWT auth prevents
unauthorised access but doesn't limit authorised users.

### 8.4 No database connection pooling configuration

`core/db.rb` calls `Sequel.connect(url)` with default pool settings. Under concurrent load
(especially with `WEB_CONCURRENCY > 0` puma workers), the default pool size (5) may be
insufficient.

---

## Summary Table

| #   | Issue                                  | Severity | Section | Status      |
|-----|----------------------------------------|----------|---------|-------------|
| 1   | Resource type shape mismatch           | P0       | §1.1    | ✅ Fixed    |
| 2   | Progress field names (ms vs seconds)   | P0       | §1.2    | ✅ Fixed    |
| 3   | P2P rooms list missing shared_resources| P0       | §1.3    | ✅ Fixed    |
| 4   | Auth store disconnected from client    | P0       | §2.1    | ✅ Fixed    |
| 5   | Dual JWT localStorage keys             | P0       | §2.2    | ✅ Fixed    |
| 6   | Plugin global singleton coupling       | P1       | §3.1    | Open        |
| 7   | Game plugin extends core module        | P1       | §3.2    | ✅ Fixed    |
| 8   | LIKE wildcard injection                | P1       | §4.3    | ✅ Fixed    |
| 9   | No CORS middleware                     | P1       | §8.2    | ✅ Fixed    |
| 10  | Electron IPC handlers missing          | P1       | §6.2    | ✅ Fixed    |
| 11  | Frontend has 0 tests                   | P1       | §7.2    | ✅ Fixed    |
| 12  | Error handling inconsistency           | P2       | §4.4    | Open        |
| 13  | No error boundaries in React           | P2       | §5.4    | Open        |
| 14  | Missing custom hooks                   | P2       | §5.3    | Open        |
| 15  | No shared type contract                | P2       | §8.1    | Open        |
| 16  | WebSocket URL is relative              | P2       | §6.1    | Open        |
| 17  | No loading/error states in some pages  | P2       | §5.5    | Open        |
| 18  | Bundle size / no code splitting        | P3       | §5.6    | Open        |
| 19  | Hot reload mutates $LOADED_FEATURES    | P3       | §4.5    | Open        |
| 20  | No rate limiting                       | P3       | §8.3    | Open        |
| 21  | DB pool size not configured            | P3       | §8.4    | Open        |
| 22  | Capabilities type implicit conversion  | P3       | §1.4    | ✅ Fixed    |

---

## Recommended Fix Order

### Phase 1 — Contract alignment (P0, before any frontend development)
1. Update `types/index.ts` Resource interface to match `to_api_h` output
2. Create per-plugin progress types (or normalise backend to a common shape)
3. Fix auth store → client.ts startup sync
4. Remove dual JWT localStorage writes

### Phase 2 — Robustness (P1)
5. Add CORS middleware to backend
6. Add Electron IPC handlers
7. Escape LIKE wildcards in name search
8. Write frontend API/store tests

### Phase 3 — Architecture (P2)
9. Introduce `PluginContext` for dependency injection
10. Extract frontend query hooks
11. Add React error boundaries
12. Generate or document API contract

### Phase 4 — Polish (P3)
13. Route-based code splitting
14. Production guard for hot reload
15. Rate limiting middleware
16. DB connection pool tuning
