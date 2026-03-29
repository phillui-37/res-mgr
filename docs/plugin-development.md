# Plugin Development Guide

This guide covers how to extend res-mgr-server-rb with custom plugins for new resource types.

## Plugin Types

The server supports two plugin architectures:

| Type        | Location           | Best For                                           |
|-------------|--------------------|----------------------------------------------------|
| Code-based  | `plugins/<name>/`  | Complex logic, custom routes, progress tracking    |
| Config-based| `config/plugins/`  | Simple resource types (filesystem scanning, URLs)  |

## Code-Based Plugins

### File Structure

```
plugins/
  my_plugin/
    plugin.rb          # Required: plugin class definition
    lib/               # Optional: additional Ruby files
```

### Minimal Plugin

```ruby
# plugins/my_plugin/plugin.rb

class MyPluginPlugin < BasePlugin
  def name         = "my_plugin"
  def version      = "1.0.0"
  def capabilities = %i[inventory]

  def routes(r)
    r.on "resources/my_plugin" do
      r.get do
        resources = DB.connection[:resources]
          .where(plugin: "my_plugin", active: true)
          .all
        resources.map { |r| r.to_api_h }.to_json
      end
    end
  end
end
```

### Plugin with Progress Tracking

```ruby
# plugins/my_plugin/plugin.rb

class MyPluginPlugin < BasePlugin
  def name         = "my_plugin"
  def version      = "1.0.0"
  def capabilities = %i[inventory viewer progress]

  def schema_migrations
    [
      {
        version: 1,
        table: :my_plugin_progress,
        up: lambda { |db|
          db.create_table?(:my_plugin_progress) do
            primary_key :id
            foreign_key :resource_id, :resources, on_delete: :cascade
            String  :device, null: false
            Integer :position
            Integer :total
            Float   :percentage, default: 0.0
            DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP
            unique [:resource_id, :device]
          end
        }
      }
    ]
  end

  def routes(r)
    r.on "resources/my_plugin" do
      # List resources
      r.get do
        DB.connection[:resources]
          .where(plugin: "my_plugin", active: true)
          .all
          .map(&:to_api_h)
          .to_json
      end

      # Resource-specific routes
      r.on Integer do |resource_id|
        r.on "progress" do
          # GET progress
          r.get do
            DB.connection[:my_plugin_progress]
              .where(resource_id: resource_id)
              .all
              .to_json
          end

          # POST progress
          r.post do
            data = Oj.load(r.body.read)
            DB.connection[:my_plugin_progress]
              .insert_conflict(
                target: [:resource_id, :device],
                update: {
                  position: data["position"],
                  total: data["total"],
                  percentage: data["percentage"],
                  updated_at: Sequel::CURRENT_TIMESTAMP
                }
              )
              .insert(
                resource_id: resource_id,
                device: data["device"],
                position: data["position"],
                total: data["total"],
                percentage: data["percentage"]
              )

            # Broadcast via WebSocket
            Websocket::Hub.instance.publish(
              "progress/my_plugin/#{resource_id}",
              { resource_id: resource_id, device: data["device"], percentage: data["percentage"] }
            )

            { ok: true }.to_json
          end
        end
      end
    end
  end
end
```

### BasePlugin Interface

All code-based plugins must subclass `BasePlugin` and implement:

| Method              | Required | Return Type      | Description                           |
|---------------------|----------|------------------|---------------------------------------|
| `name`              | ✅       | `String`         | Unique snake_case identifier          |
| `version`           | ✅       | `String`         | SemVer version string                 |
| `capabilities`      | ✅       | `Array<Symbol>`  | One or more of the available caps     |
| `schema_migrations` | ❌       | `Array`          | Database migrations for this plugin   |
| `routes(r)`         | ❌       | —                | Mount Roda routes                     |
| `on_load`           | ❌       | —                | Called after plugin loads              |
| `on_unload`         | ❌       | —                | Called before plugin unloads          |

### Available Capabilities

| Capability  | Description                                |
|-------------|-------------------------------------------|
| `inventory` | Plugin can list/scan resources             |
| `viewer`    | Plugin supports viewing/playing content    |
| `progress`  | Plugin tracks reading/playback progress    |
| `stream`    | Plugin can stream content to clients       |

### Schema Migrations

Migrations are declared as an array of hashes with the following keys:

```ruby
{
  version: 1,              # Integer, monotonically increasing
  table: :table_name,      # Optional: table to drop on rollback
  up: lambda { |db| ... }  # Sequel DB migration block
}
```

**Rules:**
- Migration versions must be unique within a plugin
- Each migration runs in a transaction
- Applied migrations are tracked in `schema_migrations_<plugin_name>` table
- On plugin unload, tables declared via `table:` key are dropped automatically
- Always use `create_table?` (with `?`) for idempotency

### Route Mounting

Routes are mounted via a Roda route block. The plugin receives the Roda request object:

```ruby
def routes(r)
  r.on "resources/my_plugin" do
    r.get do
      # Handle GET /resources/my_plugin
    end

    r.on Integer do |id|
      r.get do
        # Handle GET /resources/my_plugin/:id
      end

      r.post do
        # Handle POST /resources/my_plugin/:id
      end
    end
  end
end
```

**Important:** Plugin routes are mounted BEFORE the generic `/resources` handler. Your route prefix should be `resources/<plugin_name>` to avoid conflicts.

### WebSocket Publishing

Broadcast events to connected WebSocket clients:

```ruby
Websocket::Hub.instance.publish("topic/subtopic", {
  type: "event_type",
  data: { key: "value" }
})
```

Common topic patterns:
- `progress/<plugin>/<resource_id>` — Progress updates
- `resources` — Resource CRUD events

### Database Access

Access the Sequel database connection:

```ruby
DB.connection[:table_name].all
DB.connection[:table_name].where(id: 1).first
DB.connection[:table_name].insert(name: "test")
DB.connection[:table_name].where(id: 1).update(name: "updated")
```

### Hot Reload

Code-based plugins support hot-reload during development:

```bash
# Reload a specific plugin
curl -X POST http://localhost:3000/plugins/my_plugin/reload \
  -H "Authorization: Bearer <jwt>"
```

The reload process:
1. Calls `on_unload` on the existing instance
2. Removes the old class from Ruby's object space
3. Re-requires the plugin file
4. Instantiates the new class
5. Runs any new migrations
6. Calls `on_load`

---

## Config-Based Plugins

For simpler resource types that don't need custom logic.

### Filesystem Resource

Scans local directories for files matching extension patterns.

```yaml
# config/plugins/documents.yml
name: documents
version: "1.0.0"
type: filesystem_resource
capabilities:
  - inventory
  - viewer
extensions:
  - pdf
  - docx
  - txt
base_paths:
  - /mnt/nas/documents
  - /home/user/docs
```

**Auto-generated behavior:**
- Creates `documents_paths` table (path, extension, active, created_at)
- Mounts `GET /resources/documents` route
- Scans `base_paths` for matching files (30-second cache)
- Returns file objects: `{ path, name, plugin }`

### URL Resource

Manages collections of URLs (web content, online services).

```yaml
# config/plugins/manga.yml
name: manga
version: "1.0.0"
type: url_resource
capabilities:
  - inventory
  - viewer
```

**Auto-generated behavior:**
- Creates `manga_urls` table (url, title, provider, auth_token, active, created_at)
- Mounts `GET /resources/manga` route
- Returns all active URL entries

---

## Built-In Plugins

The server ships with 6 plugins:

| Plugin          | Type       | Capabilities                  | Progress Schema              |
|-----------------|-----------|-------------------------------|------------------------------|
| `ebook`         | Code      | inventory, viewer, progress   | page, percentage, CFI        |
| `music`         | Code      | inventory, viewer, progress   | position_ms, duration_ms     |
| `video`         | Code      | inventory, viewer, progress   | position_ms, duration_ms     |
| `game`          | Code      | inventory, viewer, progress   | launcher, steam_app_id       |
| `pic`           | Code      | inventory, viewer, progress   | image_count, cover_path      |
| `online_viewer` | Code      | inventory, viewer, progress   | progress_pct, last_page      |

---

## Testing Your Plugin

### Backend Tests (RSpec)

```ruby
# spec/unit/plugins/my_plugin_spec.rb
require "spec_helper"

RSpec.describe MyPluginPlugin do
  subject(:plugin) { described_class.new }

  it "has correct metadata" do
    expect(plugin.name).to eq("my_plugin")
    expect(plugin.version).to eq("1.0.0")
    expect(plugin.capabilities).to include(:inventory)
  end
end
```

### Integration Tests

```ruby
# spec/requests/my_plugin_spec.rb
require "spec_helper"

RSpec.describe "My Plugin API" do
  include Rack::Test::Methods

  def app = Core::App.app

  it "lists resources" do
    header "Authorization", "Bearer #{valid_jwt}"
    get "/resources/my_plugin"
    expect(last_response.status).to eq(200)
  end
end
```

### E2E Tests (Playwright)

```typescript
// e2e/tests/my-plugin/my-plugin.spec.ts
import { test, expect } from "@playwright/test";
import { createResource, saveProgress } from "../../fixtures/api.ts";

test("my plugin progress flow", async ({ page }) => {
  const r = await createResource({
    name: "test-resource",
    plugin: "my_plugin",
    locations: ["file:///test/file"],
  });

  await saveProgress("my_plugin", r.id, {
    device: "browser",
    position: 50,
    total: 100,
    percentage: 50.0,
  });

  await page.goto(`/resources/my_plugin/${r.id}`);
  await expect(page.getByText("50%")).toBeVisible();
});
```

---

## Lifecycle

```
Boot
 │
 ├── PluginLoader::File.load_all!     # Scan plugins/ directory
 │   └── For each plugin.rb:
 │       ├── require file
 │       ├── Instantiate Plugin class
 │       ├── PluginSchema.apply!(plugin)   # Run migrations
 │       ├── PluginRegistry.register(plugin)
 │       └── plugin.on_load
 │
 ├── PluginLoader::Config.load_all!   # Scan config/plugins/ directory
 │   └── For each YAML file:
 │       ├── Parse YAML
 │       ├── Generate Plugin subclass
 │       ├── PluginSchema.apply!(plugin)
 │       └── PluginRegistry.register(plugin)
 │
 └── App routes mounted
     └── Plugin routes mounted in registration order

Shutdown / Unload
 │
 └── plugin.on_unload
     └── PluginSchema.rollback!(plugin)  # Drop plugin tables
```

---

## Troubleshooting

### Plugin not loading

Check the server logs for errors:
```bash
LOG_LEVEL=debug bin/dev
```

Common issues:
- Class name must end with `Plugin` (e.g., `MyPluginPlugin`)
- Class must subclass `BasePlugin`
- File must be at `plugins/<name>/plugin.rb`

### Migration fails

- Check that table creation uses `create_table?` (idempotent)
- Check migration version numbers are unique
- Check the `schema_migrations_<name>` table for applied versions

### Route conflicts

Plugin routes must use the `resources/<plugin_name>` prefix. If your routes don't respond, check that the plugin name in routes matches the `name` method return value.
