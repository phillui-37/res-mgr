# API Reference

Base URL: `http://localhost:3000`

All endpoints require authentication unless noted otherwise.

## Authentication

Two authentication methods are supported:

### JWT Bearer Token

```
Authorization: Bearer <jwt-token>
```

Tokens are signed with HS256. Configure the secret via `JWT_SECRET` env var or `auth.jwt_secret` in `config/app.yml`.

**JWT Payload:**
```json
{
  "sub": "username",
  "iat": 1711699200,
  "exp": 1711785600
}
```

### API Key

```
X-API-Key: <api-key>
```

Configure allowed keys in `config/app.yml` under `auth.api_keys`.

### Unauthenticated Endpoints

- `GET /health` — No authentication required

---

## Health

### `GET /health`

Returns server health status and loaded plugin information.

**Response** `200 OK`
```json
{
  "status": "ok",
  "database": {
    "ok": true,
    "adapter": "sqlite"
  },
  "plugins": {
    "count": 6,
    "plugins": [
      {
        "name": "ebook",
        "version": "1.0.0",
        "capabilities": ["inventory", "viewer", "progress"]
      }
    ]
  },
  "uptime": 1234.56
}
```

When database is unreachable, `status` is `"degraded"` and `database.ok` is `false`.

---

## Resources

### `GET /resources`

List all resources with pagination and filtering.

**Query Parameters:**

| Parameter  | Type    | Default | Description                       |
|------------|---------|---------|-----------------------------------|
| `page`     | integer | 1       | Page number                       |
| `per_page` | integer | 50      | Items per page (max 200)          |
| `plugin`   | string  | —       | Filter by plugin name             |
| `type`     | string  | —       | Filter by resource type           |
| `name`     | string  | —       | Substring search on name          |

**Response Headers:**
- `X-Total-Count` — Total number of matching resources
- `X-Page` — Current page number
- `X-Per-Page` — Items per page

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "name": "My Book.epub",
    "type": "epub",
    "plugin": "ebook",
    "locations": ["file:///books/My Book.epub"],
    "tags": ["fiction", "scifi"],
    "checksum": null,
    "active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

### `POST /resources`

Create a new resource.

**Request Body:**
```json
{
  "name": "My Book.epub",
  "plugin": "ebook",
  "type": "epub",
  "locations": ["file:///books/My Book.epub"],
  "tags": ["fiction"]
}
```

**Required fields:** `name`, `plugin`

**Response** `201 Created`
```json
{
  "id": 1,
  "name": "My Book.epub",
  "plugin": "ebook",
  "type": "epub",
  "locations": ["file:///books/My Book.epub"],
  "tags": ["fiction"],
  "checksum": null,
  "active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### `GET /resources/:id`

Get a single resource by ID.

**Response** `200 OK` — Same shape as resource object above.

**Response** `404 Not Found`
```json
{ "error": "not found" }
```

### `PATCH /resources/:id`

Update a resource.

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "locations": ["file:///new/path.epub"],
  "tags": ["updated-tag"]
}
```

**Response** `200 OK` — Updated resource object.

### `DELETE /resources/:id`

Soft-delete a resource (sets `active: false`).

**Response** `200 OK`
```json
{ "ok": true }
```

### `GET /resources/duplicates`

List resources grouped by checksum to find duplicates.

**Response** `200 OK`
```json
{
  "abc123...": [
    { "id": 1, "name": "File A.epub", "plugin": "ebook" },
    { "id": 5, "name": "File A (copy).epub", "plugin": "ebook" }
  ]
}
```

### `POST /resources/:id/checksum`

Compute and store SHA-256 checksum for a resource with local file locations.

**Response** `200 OK`
```json
{ "checksum": "e3b0c44298fc1c149afbf4c8996fb924..." }
```

### `POST /resources/:id/remove-request`

Initiate a two-step removal process for remote resources. Publishes a `remove_request` event via WebSocket.

**Response** `200 OK`
```json
{ "ok": true, "message": "remove request published" }
```

---

## Plugin-Specific Resources

Each plugin mounts its own routes under `/resources/:plugin_name`.

### `GET /resources/:plugin`

List resources for a specific plugin.

**Response** `200 OK` — Array of resource objects filtered to that plugin.

### `GET /resources/:plugin/:resource_id/progress`

Get progress records for a resource.

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "resource_id": 42,
    "device": "mobile",
    "current_page": 42,
    "total_pages": 300,
    "percentage": 14.0,
    "updated_at": "2024-01-15T12:00:00Z"
  }
]
```

Progress fields vary by plugin type — see [Progress Schemas](#progress-schemas).

### `POST /resources/:plugin/:resource_id/progress`

Save or update progress for a resource on a specific device.

**Request Body** (varies by plugin):
```json
{
  "device": "browser",
  "current_page": 100,
  "total_pages": 300,
  "percentage": 33.3
}
```

**Response** `200 OK`
```json
{ "ok": true }
```

Publishes a WebSocket event to topic `progress/:plugin/:resource_id`.

---

## Progress Schemas

### Ebook Progress

| Field          | Type    | Description                    |
|----------------|---------|--------------------------------|
| `device`       | string  | Device identifier (required)   |
| `current_page` | integer | Current page number            |
| `total_pages`  | integer | Total page count               |
| `percentage`   | float   | Reading percentage             |
| `cfi_position` | string  | EPUB CFI position (optional)   |

### Music Progress

| Field         | Type    | Description                    |
|---------------|---------|--------------------------------|
| `device`      | string  | Device identifier (required)   |
| `position_ms` | integer | Current position in ms         |
| `duration_ms` | integer | Total duration in ms           |

### Video Progress

| Field         | Type    | Description                    |
|---------------|---------|--------------------------------|
| `device`      | string  | Device identifier (required)   |
| `position_ms` | integer | Current position in ms         |
| `duration_ms` | integer | Total duration in ms           |

### Game Meta

| Field          | Type   | Description                     |
|----------------|--------|---------------------------------|
| `device`       | string | Device identifier (required)    |
| `launcher`     | string | Game launcher (steam, etc.)     |
| `steam_app_id` | string | Steam application ID            |

**Special endpoint:**
- `POST /resources/game/:id/launch-ping` — Update `last_played_at` timestamp

### Pic Meta

| Field         | Type    | Description                    |
|---------------|---------|--------------------------------|
| `device`      | string  | Device identifier (required)   |
| `image_count` | integer | Number of images               |
| `cover_path`  | string  | Path to cover image            |

### Online Viewer Progress

| Field          | Type    | Description                    |
|----------------|---------|--------------------------------|
| `device`       | string  | Device identifier (required)   |
| `progress_pct` | integer | Progress percentage            |
| `last_page`    | string  | Last viewed page/chapter       |

---

## Plugins

### `GET /plugins`

List all loaded plugins.

**Response** `200 OK`
```json
[
  {
    "name": "ebook",
    "version": "1.0.0",
    "capabilities": ["inventory", "viewer", "progress"]
  },
  {
    "name": "music",
    "version": "1.0.0",
    "capabilities": ["inventory", "viewer", "progress"]
  }
]
```

### `GET /plugins/:name`

Get a single plugin's details.

**Response** `200 OK`
```json
{
  "name": "ebook",
  "version": "1.0.0",
  "capabilities": ["inventory", "viewer", "progress"]
}
```

### `POST /plugins/:name/reload`

Hot-reload a file-based plugin. Config-based plugins cannot be reloaded individually.

**Response** `200 OK`
```json
{ "reloaded": true }
```

### `POST /plugins/reload`

Reload all plugins (rescans plugin directories).

**Response** `200 OK`
```json
{ "reloaded": true }
```

---

## P2P Rooms

### `GET /p2p/rooms`

List all active P2P rooms.

**Response** `200 OK`
```json
[
  { "room_id": "my-room", "peer_count": 2 },
  { "room_id": "abc-123", "peer_count": 0 }
]
```

### `POST /p2p/rooms`

Create a new P2P room.

**Request Body:**
```json
{
  "room_id": "my-room"
}
```

`room_id` is optional — a UUID is generated if omitted.

**Response** `201 Created`
```json
{
  "room_id": "my-room",
  "ws_url": "/ws/p2p?room=my-room"
}
```

### `GET /p2p/rooms/:id`

Get room details including shared resources.

**Response** `200 OK`
```json
{
  "room_id": "my-room",
  "peer_count": 2,
  "shared_resources": [1, 5, 10]
}
```

### `POST /p2p/rooms/:id/share`

Share a resource into a room.

**Request Body:**
```json
{ "resource_id": 42 }
```

**Response** `200 OK`
```json
{ "ok": true, "room_id": "my-room", "resource_id": 42 }
```

### `DELETE /p2p/rooms/:id/share/:resource_id`

Revoke a shared resource from a room.

**Response** `200 OK`
```json
{ "ok": true, "revoked": 42 }
```

---

## WebSocket

### Hub — Pub/Sub (`/ws`)

**Connection:**
```
ws://localhost:3000/ws?topics=progress/ebook/1,resources&token=<jwt>
```

**Authentication:** Pass JWT via `token` query parameter or `Authorization` header.

**Topics:** Comma-separated list. Defaults to `["default"]` if omitted.

**Server → Client Messages:**

```json
// Subscription confirmation
{ "type": "subscribed", "topics": ["progress/ebook/1"] }

// Published event (e.g., progress update)
{
  "topic": "progress/ebook/1",
  "data": {
    "resource_id": 1,
    "device": "mobile",
    "percentage": 45.5
  }
}

// Pong (in response to ping)
{ "type": "pong" }
```

**Client → Server Messages:**

```json
// Keep-alive ping
{ "type": "ping" }
```

### P2P Signaling (`/ws/p2p`)

**Connection:**
```
ws://localhost:3000/ws/p2p?room=<room_id>&token=<jwt>
```

**Client → Server:**

```json
// Join room
{ "type": "join", "room": "room-id" }

// Send WebRTC offer
{ "type": "offer", "to": "<peer_id>", "sdp": "..." }

// Send WebRTC answer
{ "type": "answer", "to": "<peer_id>", "sdp": "..." }

// Send ICE candidate
{ "type": "ice", "to": "<peer_id>", "candidate": { ... } }

// Leave room
{ "type": "leave" }
```

**Server → Client:**

```json
// Successfully joined (self)
{ "type": "joined", "peer_id": "your-uuid", "peers": ["peer-1", "peer-2"] }

// Another peer joined
{ "type": "peer_joined", "peer_id": "new-peer-uuid" }

// Peer left
{ "type": "peer_left", "peer_id": "gone-peer-uuid" }

// Forwarded offer/answer/ICE (from another peer)
{ "type": "offer", "from": "<peer_id>", "sdp": "..." }
{ "type": "answer", "from": "<peer_id>", "sdp": "..." }
{ "type": "ice", "from": "<peer_id>", "candidate": { ... } }

// Error
{ "type": "error", "message": "description" }
```

---

## Error Responses

All errors return JSON:

```json
{ "error": "description of what went wrong" }
```

| Status | Meaning              |
|--------|----------------------|
| 400    | Bad request / missing required fields |
| 401    | Unauthorized — invalid or missing credentials |
| 404    | Resource not found   |
| 422    | Unprocessable entity — validation failed |
| 500    | Internal server error |

---

## Pagination

Resource listing endpoints support pagination via query parameters:

| Parameter  | Default | Max | Description      |
|------------|---------|-----|------------------|
| `page`     | 1       | —   | Page number      |
| `per_page` | 50      | 200 | Items per page   |

Response headers contain pagination metadata:
- `X-Total-Count` — Total matching resources
- `X-Page` — Current page
- `X-Per-Page` — Items per page

---

## CORS

The server allows all origins with the following exposed headers:
- `X-Total-Count`
- `X-Page`
- `X-Per-Page`
