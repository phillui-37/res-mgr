# res-mgr-server-rb

A modular resource management server for organizing, tracking, and sharing media collections — ebooks, music, video, games, pictures, and online content.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React 19 / Vite 8 / Electron)        │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Dashboard │ │ Resource │ │ P2P Sharing    │  │
│  │           │ │ Browser  │ │ (WebRTC)       │  │
│  └───────────┘ └──────────┘ └────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────┴──────────────────────────────┐
│  Backend (Ruby / Roda / Sequel)                 │
│  ┌─────────┐ ┌──────────┐ ┌────────────────┐    │
│  │ Auth    │ │ Inventory│ │ WebSocket Hub  │    │
│  │ (JWT)   │ │ (CRUD)   │ │ (Pub/Sub+P2P)  │    │
│  └─────────┘ └──────────┘ └────────────────┘    │
│  ┌───────────────────────────────────────────┐  │
│  │  Plugin System (6 built-in + extensible)  │  │
│  │  ebook │ music │ video │ game │ pic │ web │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────┴───────────┐
         │ SQLite / PostgreSQL │
         └─────────────────────┘
```

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Backend    | Ruby 3.4, Roda, Sequel ORM, Puma, Faye-WebSocket    |
| Frontend   | React 19, Vite 8, TanStack Query, Zustand, Electron |
| Database   | SQLite (dev/single-node), PostgreSQL (production)    |
| Auth       | JWT (HS256) + API key support                        |
| Testing    | RSpec (backend), Vitest (frontend), Playwright (E2E) |
| Dev Env    | Podman/Docker, pnpm monorepo, gel (Ruby deps)        |

## Quick Start

### Prerequisites

- **Ruby 3.4+** (via RVM) with gel gem manager
- **Node.js 22+** with pnpm
- **Podman** or Docker (for containerized development)

### Option 1: Containerized (Recommended)

```bash
# Start dev environment with SQLite
docker compose --profile dev up

# Or with PostgreSQL
docker compose --profile pg up
```

### Option 2: Local Development

```bash
# Setup Ruby dependencies
bin/setup

# Start the backend (port 3000)
bin/dev

# Start the frontend (port 5173)
cd frontend && pnpm install && pnpm --filter @res-mgr/web dev
```

The frontend proxies API requests to the backend automatically.

## Project Structure

```
res-mgr-server-rb/
├── bin/                    # Scripts (dev, setup, test, console, e2e)
├── config/
│   ├── app.yml             # Application configuration
│   ├── puma.rb             # Puma server config
│   └── plugins/            # Config-based plugin YAML files
├── config.ru               # Rack entrypoint
├── core/                   # Backend application code
│   ├── app.rb              # Main Roda router
│   ├── auth_middleware.rb   # JWT/API key authentication
│   ├── inventory/           # Resource CRUD controllers
│   ├── websocket/           # Hub (pub/sub) + P2P signaling
│   ├── plugin_loader/       # File-based + config-based loaders
│   └── base_plugin.rb      # Plugin interface
├── plugins/                # Code-based plugins
│   ├── ebook/              # Ebook plugin (progress tracking)
│   ├── music/              # Music plugin (playback position)
│   ├── video/              # Video plugin (playback position)
│   ├── game/               # Game plugin (Moonlight/Steam)
│   ├── pic/                # Picture plugin (image metadata)
│   └── online_viewer/      # Web content viewer
├── frontend/               # pnpm monorepo
│   └── packages/
│       ├── web/            # React SPA (Vite)
│       └── desktop/        # Electron wrapper
├── db/                     # SQLite databases + migrations
├── spec/                   # RSpec tests (unit + integration)
├── e2e/                    # Playwright E2E tests
└── docs/                   # Documentation
```

## Plugin System

The server supports two types of plugins:

### Code-Based Plugins (`plugins/`)

Full Ruby plugins with custom routes, schema migrations, and business logic.

```ruby
# plugins/my_plugin/plugin.rb
class MyPluginPlugin < BasePlugin
  def name         = "my_plugin"
  def version      = "1.0.0"
  def capabilities = %i[inventory progress]

  def schema_migrations
    [{ version: 1, table: :my_progress, up: ->(db) { ... } }]
  end

  def routes(r)
    r.on "resources/my_plugin" do
      r.get { |id| ... }
    end
  end
end
```

### Config-Based Plugins (`config/plugins/`)

YAML-defined plugins for common patterns (filesystem scanning, URL management).

```yaml
# config/plugins/my_content.yml
name: my_content
version: "1.0.0"
type: filesystem_resource   # or url_resource
capabilities: [inventory, viewer]
extensions: [pdf, epub]
base_paths: [/mnt/nas/content]
```

See [Plugin Development Guide](docs/plugin-development.md) for details.

## Configuration

Main config lives in `config/app.yml`. Environment variables override YAML values:

| Variable             | Default              | Description                    |
|----------------------|----------------------|--------------------------------|
| `DATABASE_URL`       | `sqlite://db/...`    | Database connection URL        |
| `JWT_SECRET`         | `changeme`           | JWT signing secret             |
| `JWT_EXPIRY_SECONDS` | `86400`              | Token TTL (24h default)        |
| `APP_PORT`           | `3000`               | Server listen port             |
| `APP_HOST`           | `0.0.0.0`            | Server bind address            |
| `PLUGIN_DIR`         | `plugins`            | Code-based plugins directory   |
| `PLUGIN_CONFIG_DIR`  | `config/plugins`     | Config-based plugins directory |
| `LOG_LEVEL`          | `info`               | Log level                      |

## Testing

```bash
# Backend unit + integration tests
bin/test

# Frontend unit tests
cd frontend && pnpm test

# E2E tests (requires both backend + frontend running)
bin/e2e

# E2E with Playwright UI
bin/e2e --ui

# E2E in headed mode (visible browser)
bin/e2e --headed
```

| Suite        | Framework   | Count | Location       |
|-------------|-------------|-------|----------------|
| Backend     | RSpec       | 80+   | `spec/`        |
| Frontend    | Vitest      | 43    | `frontend/`    |
| E2E         | Playwright  | 49    | `e2e/`         |

## API Overview

All endpoints require authentication (JWT Bearer token or API key), except `/health`.

| Method   | Endpoint                              | Description                    |
|----------|---------------------------------------|--------------------------------|
| `GET`    | `/health`                             | Server health + plugin status  |
| `GET`    | `/resources`                          | List resources (paginated)     |
| `POST`   | `/resources`                          | Create resource                |
| `GET`    | `/resources/:id`                      | Get resource detail            |
| `PATCH`  | `/resources/:id`                      | Update resource                |
| `DELETE` | `/resources/:id`                      | Soft-delete resource           |
| `GET`    | `/resources/:plugin/:id/progress`     | Get progress records           |
| `POST`   | `/resources/:plugin/:id/progress`     | Save progress                  |
| `GET`    | `/plugins`                            | List loaded plugins            |
| `POST`   | `/plugins/:name/reload`               | Hot-reload a plugin            |
| `GET`    | `/p2p/rooms`                          | List P2P rooms                 |
| `POST`   | `/p2p/rooms`                          | Create P2P room                |
| `POST`   | `/p2p/rooms/:id/share`                | Share resource into room       |
| `WS`     | `/ws?topics=...`                      | Pub/sub hub                    |
| `WS`     | `/ws/p2p?room=...`                    | WebRTC signaling               |

See [API Documentation](docs/api.md) for full reference.

## WebSocket

Two WebSocket endpoints for real-time features:

- **Hub** (`/ws`) — Topic-based pub/sub for progress updates, resource events
- **P2P Signaling** (`/ws/p2p`) — WebRTC offer/answer/ICE exchange for peer-to-peer sharing

## Docker Profiles

| Profile  | Database   | Use Case                              |
|----------|-----------|---------------------------------------|
| `dev`    | SQLite    | Development with hot-reload           |
| `sqlite` | SQLite    | Production-like single-node           |
| `pg`     | PostgreSQL| Production with PostgreSQL            |

## License

Private project — all rights reserved.
