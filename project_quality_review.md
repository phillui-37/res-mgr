# Project Quality Review — res-mgr-server-rb

> Reviewed: 2026-03-29  
> Stack: Ruby 3.4 · Roda · Sequel · faye-websocket · gel · Podman  
> Reviewer: architecture-auditor

---

## Executive Summary

`res-mgr-server-rb` is a well-conceived Ruby backend with a clear purpose and a deliberately
lean stack (no Rails). The plugin architecture is the strongest design decision: adding a new
resource type requires only a new `plugins/<name>/plugin.rb` file with no changes to core code.
The containerized development setup is complete and the test suite is comprehensive (171
examples).

However, several systematic issues undermine the stated SOLID/KISS goals:

1. **A latent routing bug silently breaks all 6 plugin sub-resource routes** (e.g.
   `GET /resources/ebook/123/progress` returns the collection instead of the progress record).
2. **DRY violations are pervasive**: identical `halt!` logic appears in three controllers,
   and the entire authentication implementation is copy-pasted between `AuthMiddleware` and
   `Websocket::Auth`.
3. **Controllers are untestable in isolation**: fully static (`class << self`) with no
   dependency injection — every test must mock global singletons.
4. **A committed default JWT secret** (`"changeme"`) with no startup guard is a security risk.

Issues are prioritised below. Fixes range from one-liners to targeted refactors; none require
an architectural overhaul.

---

## 1. SOLID Principles

### 1.1 Single Responsibility Principle (SRP)

**`ResourceController` mixes routing, validation, business logic, and I/O** *(major)*  
`core/inventory/resource_controller.rb` — `call`, `create_resource`, `compute_checksum`,
`remove_request`.

- `compute_checksum` performs file I/O (reads the file), hashes it, updates the DB record, and
  returns an API response — four responsibilities in one method.
- `remove_request` decides access policy ("cannot remove online_viewer resources"), publishes a
  WebSocket event, and formats a response.
- Validation (`halt_invalid!`) and error formatting (`halt!`) are also folded in.

**Recommendation:** Extract a `ResourceService` class that owns `compute_checksum` and
`remove_request` business logic. Controllers should only parse input, delegate to the service,
and format output.

---

**`PluginLoader::File.load_file` does too much** *(minor)*  
`core/plugin_loader/file.rb:32-53`

Responsibilities: reading a file, discovering new constants, finding the plugin class,
instantiating it, registering it, and logging. If any step fails, it is unclear which step the
error came from.

**Recommendation:** Extract `discover_plugin_class(path)` as a private method and separate
the "find class" step from the "register" step.

---

**`HealthController` owns its own boot time** *(minor)*  
`core/health_controller.rb:45` — `boot_time!` is called at class load time. This conflates
"time the application started" with "time this class file was parsed", and makes the
`HealthController` responsible for infrastructure state that it does not own.

**Recommendation:** Record boot time in `core/boot.rb` (or `AppConfig`) and pass it to
`HealthController.status` via a class attribute set at startup.

---

### 1.2 Open/Closed Principle (OCP)

**Plugin architecture is correctly OCP-compliant** *(strength)*  
Adding a new resource type requires only creating `plugins/<name>/plugin.rb`. No core files need
to change. This is the system's strongest architectural decision.

---

**`Core::App` route block must be modified to add new top-level namespaces** *(major)*  
`core/app.rb:18-55` — `health`, `ws`, `plugins`, `p2p`, and `resources` are all hardcoded.

**Recommendation:** Introduce a `Core::Router` module that controllers can register themselves
into (`Core::Router.mount(namespace: "p2p", handler: P2PController)`). `Core::App` then
iterates registrations, similar to how plugin routes are mounted.

---

**Adding a new auth strategy requires modifying two files** *(major)*  
Both `AuthMiddleware` and `Websocket::Auth` contain identical `verify_jwt` and `verify_api_key`
implementations (see §3 below). Any new strategy (OAuth, mTLS, session cookie) must be added in
both places.

**Recommendation:** Extract a `Core::Authenticator` module that both middleware classes
delegate to.

---

### 1.3 Liskov Substitution Principle (LSP)

**`GamePlugin#show` returns `{ error: "Not found" }` with HTTP 200** *(minor)*  
`plugins/game/plugin.rb:48-50`

```ruby
def show(resource_id)
  resource = Resource[resource_id]
  return { error: "Not found" } unless resource   # ← 200 status
  ...
end
```

Every other controller/plugin uses `throw :halt` for error responses, ensuring the HTTP status
code is non-200. `GamePlugin#show` silently swallows the error as a 200 JSON body. Clients
cannot distinguish success from failure by status code.

**Recommendation:** Use `throw :halt, [404, ...]` consistently, as all other error paths do.

---

**Plugin `routes(r)` contract is side-effect only with no return contract** *(minor)*  
`BasePlugin#routes` returns `nil` by default; concrete plugins return the value of the last
`r.on` call, which is undefined. This is fine at runtime but documents poorly.

**Recommendation:** Clarify the contract in `BasePlugin` (`# @return [void]`) and ensure the
default implementation makes the intent explicit.

---

### 1.4 Interface Segregation Principle (ISP)

**`BasePlugin::CAPABILITIES` constant is defined but never enforced** *(minor)*  
`core/base_plugin.rb:16` defines `CAPABILITIES = %i[inventory viewer progress stream]`.
However, no code validates that a plugin's `capabilities` return value is a subset of this
constant. A plugin returning `[:flying]` is silently accepted.

**Recommendation:** Add validation in `PluginRegistry#register`:

```ruby
invalid = plugin.capabilities - BasePlugin::CAPABILITIES
raise ArgumentError, "Unknown capabilities: #{invalid}" unless invalid.empty?
```

---

**`BasePlugin` interface is appropriate for the domain** *(strength)*  
All five methods (`name`, `version`, `capabilities`, `schema_migrations`, `routes`) have
sensible defaults (`[]` and `nil`). Simple plugins like `PicPlugin` are not forced to implement
anything beyond name/version/capabilities.

---

### 1.5 Dependency Inversion Principle (DIP)

**High-level modules depend directly on global singletons** *(critical)*

Every plugin and controller accesses dependencies as global concretions:

| Dependency | Callers |
|---|---|
| `DB.connection` | `EbookPlugin`, `MusicPlugin`, `VideoPlugin`, `GamePlugin`, `PicPlugin`, `OnlineViewerPlugin`, `ResourceController`, `P2PController` |
| `Websocket::Hub.instance` | `EbookPlugin`, `MusicPlugin`, `VideoPlugin`, `OnlineViewerPlugin`, `ResourceController`, `P2PController` |
| `AppConfig.get` | `AuthMiddleware`, `Websocket::Auth`, `RequestLogger`, `PluginLoader::File`, `PluginLoader::Config`, `PluginHotReload`, `DB` |
| `PluginRegistry.instance` | `Core::App`, `HealthController`, `PluginLoader::File`, `PluginLoader::Config`, `PluginController` |

This makes unit tests impossible without mocking class-level methods on global singletons.
It also means that swapping the DB layer, message bus, or config source requires hunting every
caller.

**Recommendation (pragmatic):** Since this is a solo/small-team project, the full DI container
pattern would add unnecessary complexity. Instead:
1. Pass `db:` and `hub:` as keyword arguments to plugin constructors (with defaults pointing to
   the singletons). This makes tests trivial and callers explicit.
2. For `AppConfig`, freeze the config struct at boot and pass it to objects that need it.

---

**`PluginRegistry#register` directly calls `PluginSchema.apply!`** *(major)*  
`core/plugin_registry.rb:29`

```ruby
def register(plugin)
  synchronize do
    ...
    PluginSchema.apply!(plugin)   # ← concrete coupling
    ...
  end
end
```

The registry should not know about schema migration. This couples two separate concerns.

**Recommendation:** Invert the dependency by accepting an optional `on_register:` callback in
`PluginRegistry`, or call `PluginSchema.apply!` explicitly in `PluginLoader` before
`registry.register`.

---

**`P2PController` reaches inside `P2PSignaling`'s private state** *(critical)*  
`core/p2p_controller.rb:32,43`

```ruby
signaling.instance_variable_get(:@rooms).map { |room_id, peers| ... }
```

This is the most egregious encapsulation violation in the codebase. `@rooms` is an internal
implementation detail of `P2PSignaling`. If the data structure changes (e.g. from `Hash` to
a custom `RoomSet`), `P2PController` silently breaks.

**Recommendation:** Add public methods to `P2PSignaling`:

```ruby
def rooms_summary
  synchronize { @rooms.map { |id, peers| { room_id: id, peer_count: peers.size } } }
end

def room(id)
  synchronize { @rooms[id] }
end
```

---

## 2. DRY Violations

### 2.1 `halt!` triplicated across controllers *(critical)*

Three controllers contain identical error-response code under two different names:

```ruby
# core/inventory/resource_controller.rb:115
def halt!(status, message)
  throw :halt, [status, { "content-type" => "application/json" },
                [Oj.dump({ error: message }, mode: :compat)]]
end

# core/p2p_controller.rb:83
def halt!(status, message)          # identical to above
  ...
end

# core/plugin_controller.rb:47
def r_halt(status, message)         # different name, same implementation
  throw :halt, [status, { "content-type" => "application/json" },
                [Oj.dump({ error: message }, mode: :compat)]]
end
```

**Recommendation:** Extract to `core/controller_helpers.rb`:

```ruby
module ControllerHelpers
  def halt!(status, message)
    throw :halt, [status, { "content-type" => "application/json" },
                  [Oj.dump({ error: message }, mode: :compat)]]
  end
end
```

Include it in each controller: `extend ControllerHelpers`.

---

### 2.2 Authentication logic fully duplicated *(critical)*

`AuthMiddleware` (`core/auth_middleware.rb:47-66`) and `Websocket::Auth`
(`core/websocket/auth.rb:45-65`) contain byte-for-byte identical implementations of:
- `bearer_token(env)`
- `verify_jwt(token)`
- `verify_api_key(key)`
- `unauthorized` response

The only difference is that `AuthMiddleware` also has `skip?(env)` and `Websocket::Auth` has
`token_from_query(env)`.

**Recommendation:** Extract to `core/authenticator.rb`:

```ruby
module Authenticator
  def authenticate(env)
    token = token_from_query(env) if respond_to?(:token_from_query, true)
    token ||= bearer_token(env)
    return verify_jwt(token) if token
    api_key = env["HTTP_X_API_KEY"]
    verify_api_key(api_key) if api_key
  end

  private

  def bearer_token(env) = ...
  def verify_jwt(token) = ...
  def verify_api_key(key) = ...
  def unauthorized = ...
end
```

Both middleware classes `include Authenticator`.

---

### 2.3 Plugin progress-update pattern repeated verbatim *(minor)*

`EbookPlugin`, `MusicPlugin`, `VideoPlugin`, and `OnlineViewerPlugin` all implement
`update_progress` with the same structure:
1. Extract `device` from `r.POST` with `|| "unknown"` fallback
2. Call `DB.connection[:<table>].insert_conflict(...).insert(...)`
3. Call `Websocket::Hub.instance.publish("progress/#{plugin_name}/#{resource_id}", ...)`
4. Return `{ ok: true }`

Steps 3 and 4 are verbatim. This isn't a blocker but a `ProgressTracker` concern would
eliminate repetition once a fourth (or fifth) progress-tracking plugin appears.

---

## 3. Security Concerns

### 3.1 Default JWT secret committed to source control *(critical)*

`config/app.yml:16`:

```yaml
auth:
  jwt_secret: "changeme"
```

If `JWT_SECRET` environment variable is not set, the application boots silently with this weak
secret. An attacker who reads the source code can forge any JWT.

**Recommendation:** Add a startup guard in `core/boot.rb`:

```ruby
secret = AppConfig.get(:auth, :jwt_secret)
if secret.nil? || secret == "changeme" || secret.length < 32
  raise "FATAL: JWT secret is insecure. Set JWT_SECRET env var to a random 32+ char string."
end
```

---

### 3.2 Plugin files are executed with full process privileges *(major)*

`core/plugin_loader/file.rb:34`:

```ruby
require ::File.expand_path(path)
```

Any `.rb` file placed in the `plugins/` directory is executed as trusted Ruby code with full
access to the process, filesystem, and network. The hot-reload watcher (`PluginHotReload`)
adds a filesystem event trigger to this attack surface.

**Recommendation:**
- Document this explicitly as a trust boundary (the plugins directory must be protected from
  untrusted writes).
- For production, consider validating file ownership or a content hash before loading.
- At minimum, restrict the plugin directory to a non-world-writable path.

---

### 3.3 API keys stored as plain strings in YAML *(minor)*

`config/app.yml auth.api_keys` (if populated) stores keys in plaintext. Anyone with read access
to the config file sees all active keys.

**Recommendation:** Support hashed API keys (store `BCrypt::Password.create(key)`, compare with
`BCrypt::Password.new(stored) == provided_key`). At minimum, document that this config file
must be excluded from source control.

---

### 3.4 `online_viewer` stores `auth_token` without enforcement *(minor)*

`plugins/online_viewer/plugin.rb:22` — the `auth_token` column comment says
`# encrypted or hashed; never logged` but the application stores and retrieves the token as
plaintext. The comment documents intent that the code does not enforce.

**Recommendation:** Either encrypt at-rest (AES-256-GCM via the `lockbox` gem) or treat the
token as write-only (store a hash, never read it back).

---

## 4. Roda Routing Issues

### 4.1 All six plugins share the same routing bug *(critical)*

The same class of bug fixed in `P2PController` and `PluginController` during testing is
**present and unfixed in all six built-in plugins**.

In Roda, `r.get` without arguments calls `always`, which matches *regardless of remaining path*.
When `r.get` is placed **before** `r.on Integer`, it captures every GET request including
those intended for sub-resources:

```ruby
# ALL plugins have this structure:
r.on "resources/ebook" do
  r.get do                        # ← `always` matcher — captures EVERYTHING
    Resource.where(plugin: "ebook", active: true).map(&:to_api_h)
  end
  r.on Integer do |resource_id|  # ← NEVER REACHED for any GET
    r.get("progress") { ... }
    ...
  end
end
```

**Effect:** `GET /resources/ebook/123/progress` silently returns the full ebook list with
HTTP 200. No error is raised. This is the single highest-priority bug in the codebase.

**Fix pattern** (same as applied to P2PController):

```ruby
r.on "resources/ebook" do
  r.on Integer do |resource_id|  # deeper paths first
    r.get("progress")  { get_progress(resource_id) }
    r.post("progress") { update_progress(resource_id, r) }
  end
  r.get { Resource.where(plugin: "ebook", active: true).map(&:to_api_h) }
end
```

Affected files:
- `plugins/ebook/plugin.rb:33-44`
- `plugins/music/plugin.rb:31-40`
- `plugins/video/plugin.rb:32-41`
- `plugins/game/plugin.rb:32-43`
- `plugins/pic/plugin.rb:29-39`
- `plugins/online_viewer/plugin.rb:35-46`

---

### 4.2 Plugin routes use slash-in-string segment *(minor)*

```ruby
r.on "resources/ebook" do   # matches the combined literal "resources/ebook"
```

This works because Roda's `r.on(String)` matches a path prefix. However, it is idiomatic in
Roda to use nested `r.on` for nested path segments:

```ruby
r.on "resources" do
  r.on "ebook" do
    ...
  end
end
```

The current approach prevents route reuse (e.g., a hypothetical shared `r.on "resources"` block
across all plugins) and is surprising to anyone familiar with standard Roda conventions.

---

### 4.3 Plugin routes re-evaluated on every request *(minor)*

`core/app.rb:49`:

```ruby
PluginRegistry.instance.each { |plugin| plugin.routes(r) }
```

This iterates all registered plugins on every HTTP request and calls each plugin's `routes`
method (which contains `r.on` calls). Roda `r.on` calls have negligible overhead per call, but
the pattern does not scale well to 50+ plugins and prevents any compile-time route optimization.

**Recommendation:** Investigate Roda's `r.run` and sub-app routing to pre-compile plugin route
trees, or at minimum document the O(n) per-request cost.

---

## 5. Missing Abstractions

### 5.1 No service layer *(major)*

Controllers contain business logic that has no natural home:

- `ResourceController#compute_checksum` — reads a file, computes SHA-256, persists result
- `ResourceController#remove_request` — enforces policy ("online_viewer cannot be removed"),
  publishes WebSocket event
- `P2PController#share_resource` — validates resource existence, persists join record,
  publishes WebSocket event

This violates SRP and makes the logic untestable without going through HTTP.

**Recommendation:** Introduce `core/services/resource_service.rb` with instance methods that
accept a `db:` and `hub:` argument. Controllers become thin adapters that parse params and
call the service.

---

### 5.2 No public API on `P2PSignaling` for room state *(major)*

`P2PSignaling` is the authoritative source of room state but exposes no public methods for
querying it. `P2PController` works around this with `instance_variable_get` (see §1.5).

**Recommendation:** Add `rooms_summary`, `room(id)`, and `room_exists?(id)` as public methods
on `P2PSignaling`.

---

### 5.3 `Resource` model combines data mapping with API serialization *(minor)*

`core/inventory/resource.rb:36` — `to_api_h` is a view-layer concern living in the model.
This means changing the API response shape requires changing the model.

**Recommendation:** Extract to a presenter/serializer (`ResourcePresenter`). For a project of
this size, this is low priority but worth noting.

---

## 6. Testability

### 6.1 Static controllers are hard to test without global mocks *(major)*

Because all controllers are `class << self` with no constructor, there is no way to inject a
test double for `DB`, `Websocket::Hub`, or `PluginRegistry`. The test suite currently works
around this by mocking class-level methods (`allow(Websocket::Hub.instance).to receive(:publish)`),
which is fragile and obscures intent.

**Recommendation:** Convert controllers to instantiable classes with optional keyword arguments:

```ruby
class ResourceController
  def initialize(db: DB.connection, hub: Websocket::Hub.instance)
    @db  = db
    @hub = hub
  end

  def call(r)
    # use @db, @hub
  end
end
```

---

### 6.2 `PluginRegistry` singleton state must be saved/restored in every unit test *(major)*

`spec/unit/plugin_registry_spec.rb:22-27` — each test saves and restores `@plugins`. If an
exception occurs inside the test before the `ensure` fires, state could leak.

This is a symptom of the singleton being global mutable state. **Recommendation:** Keep the
registry as a singleton for production, but add a `.reset!` class method guarded by
`raise "only in test environment" unless Rails.env.test?` (or equivalent env check).

---

### 6.3 Missing test coverage areas *(minor)*

The following behaviours have no tests:
- Plugin hot-reload (`PluginHotReload#start!`, `PluginLoader::File.reload_file`)
- Plugin-specific sub-resource routes (`GET /resources/ebook/123/progress`) — the latent routing
  bug in §4.1 was not caught because this path was never exercised
- Concurrent access to `PluginRegistry` (thread-safety claim untested)
- WebSocket pub/sub lifecycle (subscribe → receive publish → disconnect)
- `PluginLoader::Config.load_all!` with a real YAML file on disk

---

## 7. Minor / Style Issues

| # | Location | Issue | Recommendation |
|---|---|---|---|
| 1 | `online_viewer/plugin.rb:52` | `select_map { \|row\| row.except(:auth_token) }` — `select_map` is a column-projection method, not row-transform; the block returns a modified Hash but `select_map` ignores it | Use `.all.map { \|r\| r.except(:auth_token) }` |
| 2 | `resource_controller.rb:36` | No pagination — `Resource.where(active: true).map(&:to_api_h)` returns all records | Add `limit`/`offset` query params |
| 3 | `core/db.rb:30` | `DB.migrate!` called at every app start in `core/boot.rb` | Acceptable in dev; add `SKIP_MIGRATIONS=1` env guard for production |
| 4 | `core/request_logger.rb` | No structured logging, no correlation ID, no request body logging | Consider `semantic_logger` or JSON-format logger |
| 5 | `plugin_loader/file.rb:62` | `$LOADED_FEATURES.delete(...)` is global mutable state | Acceptable for hot-reload; document the risk and run only in dev |
| 6 | `plugin_loader/file.rb:33-35` | `Object.constants` snapshot before/after `require` is thread-unsafe | Use a Mutex around the require or extract class name from filename convention |
| 7 | `plugin_loader/config.rb:114` | `FilesystemPlugin#scan_paths` runs `Dir.glob` on every GET request | Add a simple TTL cache (e.g., memoize for 30s) |
| 8 | `base_plugin.rb` | `CAPABILITIES` constant exists but is never validated at registration | Validate in `PluginRegistry#register` (see §1.4) |
| 9 | `plugin_controller.rb:47` | `r_halt` name differs from `halt!` used in other two controllers | Standardise to `halt!` |
| 10 | `config/app.yml` | No `api_keys:` array defined by default | Document the expected format with a commented-out example |

---

## 8. Prioritised Remediation Roadmap

### P0 — Fix immediately (correctness / security)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 1 | Routing bug: `r.get` before `r.on Integer` in all 6 plugins | `plugins/*/plugin.rb` | Small (pattern replace) |
| 2 | JWT secret startup guard | `core/boot.rb` | Tiny |

### P1 — Fix soon (DRY / maintainability)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 3 | Extract `ControllerHelpers` module for `halt!` | `core/controller_helpers.rb` + 3 controllers | Small |
| 4 | Extract `Authenticator` module | `core/authenticator.rb` + `auth_middleware.rb` + `websocket/auth.rb` | Small |
| 5 | Add public room API to `P2PSignaling` | `core/websocket/p2p_signaling.rb` + `p2p_controller.rb` | Small |
| 6 | Fix `GamePlugin#show` to return 404 via `throw :halt` | `plugins/game/plugin.rb` | Tiny |
| 7 | Fix `online_viewer` `select_map` misuse | `plugins/online_viewer/plugin.rb` | Tiny |

### P2 — Improve when opportunity arises (architecture)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 8 | Add `PluginRegistry#register` capability validation | `core/plugin_registry.rb` | Tiny |
| 9 | Decouple `PluginSchema.apply!` from `PluginRegistry#register` | `core/plugin_registry.rb` + loaders | Small |
| 10 | Add pagination to resource listings | `core/inventory/resource_controller.rb` | Small |
| 11 | Add test coverage for plugin sub-routes + hot-reload | `spec/` | Medium |

### P3 — Consider for v2 (structural improvements)

| # | Issue | Benefit | Effort |
|---|---|---|---|
| 12 | Extract service layer (`ResourceService`) | Testability, SRP | Medium |
| 13 | Convert controllers to injectable instances | Testability, DIP | Medium |
| 14 | Extract `Authenticator` module | OCP, DRY | Small |
| 15 | Structured logging with correlation IDs | Observability | Medium |
| 16 | Hash API keys at rest | Security | Small |

---

## 9. Addendum — Additional Findings (Second Audit Pass)

### 9.1 Race condition in `P2PSignaling#relay` *(critical)*

`core/websocket/p2p_signaling.rb:113–117`

```ruby
def relay(src_ws, src_peer_id, msg, type, required_fields)
  to_peer_id = msg["to"]
  info = @peers[src_ws]           # ← unsynchronized read
  dest_ws = @rooms.dig(info[:room_id], to_peer_id)  # ← unsynchronized read
  ...
end
```

`leave_room` modifies both `@peers` and `@rooms` inside a `synchronize` block, but `relay`
reads them outside one. On a multi-threaded Puma server a concurrent `leave_room` can delete
a peer between the two reads in `relay`, producing a `NoMethodError` on `nil` or routing
a message to a closed WebSocket.

**Fix:** Wrap the two reads in `synchronize`:

```ruby
info, dest_ws = synchronize do
  info = @peers[src_ws]
  dest_ws = info && @rooms.dig(info[:room_id], to_peer_id)
  [info, dest_ws]
end
```

---

### 9.2 `docker-compose.yml` hardcodes weak Postgres password *(major — security)*

`docker-compose.yml` contains:

```yaml
POSTGRES_PASSWORD: secret
```

This appears in image build history and any repository clone. Use a `.env` file (excluded
from source control) and reference it:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

---

### 9.3 `PluginSchema.rollback!` does not drop tables *(major)*

`core/plugin_schema.rb:21–30` — `rollback!` deletes rows from the
`schema_migrations_<plugin>` tracking table but **does not execute `DROP TABLE`** on the
plugin's actual tables (e.g., `ebook_progress`, `game_meta`). After unloading a plugin:

- Orphaned tables remain in the database indefinitely.
- On re-registration, `create_table?` silently skips, masking potential schema drift between
  plugin versions.

**Fix:** Either drop the plugin's tables in `rollback!`, or rename the method to
`wipe_migration_log!` and document that table removal is out-of-scope.

---

### 9.4 Plugin migration versions are array-index derived *(major)*

`core/plugin_schema.rb:9`:

```ruby
plugin.schema_migrations.each_with_index do |migration_proc, idx|
  version = idx + 1
  run_migration(db, plugin.name, version, migration_proc)
end
```

Inserting a new migration anywhere except at the end reassigns all subsequent version
numbers. Already-applied migrations then appear unrecorded (their version records no longer
match), causing them to be re-run.

**Fix:** Have plugins declare explicit version constants, or derive the version from a
content hash of the migration proc source (`migration_proc.source_location` +
`migration_proc.hash`).

---

### 9.5 Fragmented `Logger.new($stdout)` instances *(minor)*

`PluginLoader::File`, `PluginLoader::Config`, `PluginHotReload`, `Websocket::Hub`,
`Websocket::P2PSignaling`, and `RequestLogger` each create their own `Logger.new($stdout)`
constant. There is no shared logger, no correlation ID propagation, and no way to change the
global log level at runtime without touching every file.

**Recommendation:** Introduce `core/app_logger.rb`:

```ruby
module AppLogger
  LOGGER = Logger.new($stdout).tap do |l|
    l.level = Logger.const_get(AppConfig.get(:log, :level).upcase)
  end
  def self.logger = LOGGER
end
```

All other files reference `AppLogger.logger` instead of their own instance.

---

### 9.6 Unused gems inflate dependency surface *(minor)*

`Gemfile` declares two gems with no corresponding usage in the source:

| Gem | Declared purpose | Actual usage |
|---|---|---|
| `bcrypt` | API key hashing | Not used anywhere; plaintext keys in YAML |
| `zeitwerk` | Autoloading | Not used; all loading is `require_relative` chains |

Both should be removed until actively needed. `bcrypt` should be re-added once API key
hashing is implemented.

---

### 9.7 `puma.rb` `preload_app!` is a no-op with `workers 0` *(minor)*

`config/puma.rb:3`:

```ruby
workers 0
preload_app!
```

`preload_app!` only has effect when `workers > 0` (fork-based workers). With `workers 0`
(single-process Puma), it is silently ignored. For production, configure:

```ruby
workers ENV.fetch("WEB_CONCURRENCY", 2).to_i
preload_app!
```

---

*End of review.*
