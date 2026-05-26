<div align="center">

<img src="./Docklet-logo.png" alt="Docklet" width="220" />

**A calm, beautiful web UI for your Docker Compose stacks.**

Point Docklet at a folder of compose projects. See them all at a glance,
with live CPU and memory. Click into one to start, stop, restart, update,
or read its logs. That's the whole product.

<sub>FastAPI · docker-py · React · Vite · Tailwind · Framer Motion</sub>

</div>

---

## Why

If you self-host a handful of Docker Compose stacks, you don't need Portainer's
acreage or a full PaaS. You need:

- one page that shows every stack you have,
- a quick read on CPU / memory / state,
- and buttons for the four things you actually do: **start, stop, restart, pull**.

Docklet is that page.

## How it finds your stacks

You give Docklet **one folder** (`STACKS_DIR`). Every immediate subfolder that
contains a `docker-compose.yml` (or `compose.yaml`) becomes a managed stack.
The folder name becomes the Docker Compose project name, which is how Docklet
correlates folders to running containers.

```
docker-stacks/
├── plex/
│   ├── docker-compose.yml
│   └── config/
├── nextcloud/
│   ├── docker-compose.yml
│   └── data/
└── homepage/
    └── compose.yaml
```

Drop a folder in → it shows up. Remove it → it disappears. No registration UI,
no database to keep in sync.

## Quick start (self-host)

1. Copy [`docker-compose.example.yml`](./docker-compose.example.yml) to
   `~/docklet/docker-compose.yml` and [`.env.example`](./.env.example) to
   `~/docklet/.env`.

2. Edit `.env`:
   ```env
   STACKS_DIR=/home/you/docker-stacks
   ```

3. Bring it up:
   ```sh
   cd ~/docklet
   docker compose up -d
   ```

4. Open <http://localhost:8765>.

### ⚠️ The one gotcha: volume paths

Docklet runs **inside a container** but tells the host's Docker daemon what to
do. When your stacks' compose files use bind paths like `./data:/data`, those
paths are resolved by the **host** daemon, not inside Docklet.

So in `docker-compose.example.yml` we mount your stacks folder at the **same
path** inside the container as on the host:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
  - ${STACKS_DIR}:${STACKS_DIR}   # ← same path on both sides
```

If you change one side, change the other. This avoids a class of bugs where
`./data` "works" from inside the container but the daemon binds a different
directory on the host.

## Environment variables

| Variable                  | Default                  | What it does                                              |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| `DOCKLET_STACKS_DIR`      | `/stacks`                | Root folder scanned for compose projects.                 |
| `DOCKLET_HOST`            | `0.0.0.0`                | Bind address for the HTTP server.                         |
| `DOCKLET_PORT`            | `8765`                   | Port for the HTTP server.                                 |
| `DOCKLET_DOCKER_HOST`     | _(unset → unix socket)_  | Override to talk to a remote daemon (e.g. `tcp://…`).     |
| `DOCKLET_COMPOSE_BIN`     | `/usr/local/bin/docker-compose` (image), `docker-compose` (dev) | Path to the compose binary. Set to `"docker compose"` to use the CLI plugin. |
| `DOCKLET_FRONTEND_DIST`   | `/app/static`            | Where the built React bundle lives. Don't usually touch.  |

## Build & publish your own image

A `Makefile` wraps `docker buildx` for multi-arch builds (amd64 + arm64).

```sh
# one-time per host
make buildx-init

# local single-arch image (no push)
make image

# publish to GHCR
make push REGISTRY=ghcr.io/yourname IMAGE=docklet TAG=v0.1.0

# publish to Docker Hub
make push REGISTRY=yourdockerhub IMAGE=docklet TAG=latest
```

A GitHub Actions workflow at `.github/workflows/publish.yml` builds and pushes
to GHCR automatically on pushes to `main` (as `:latest`) and on tagged releases
(`v*.*.*`).

## Architecture

```
┌──────────────────────────────────────────────────┐
│ Browser (React + Vite + Tailwind + Framer)       │
│   ├─ Dashboard         GET   /api/stacks         │
│   ├─ Stack detail      GET   /api/stacks/:name   │
│   ├─ Actions           POST  /api/stacks/:name/* │
│   └─ Live metrics       WS   /api/ws/stats       │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│ FastAPI (backend/app/)                           │
│   discovery.py    – scan STACKS_DIR              │
│   docker_service  – docker-py + `docker compose` │
│   api.py          – routes (thin)                │
└─────────────────────┬────────────────────────────┘
                      │ docker.sock
┌─────────────────────▼────────────────────────────┐
│ Host Docker daemon                               │
└──────────────────────────────────────────────────┘
```

- **Reads** (list containers, stats) go through the docker-py SDK.
- **Actions** (up/down/restart/pull) shell out to `docker compose`. Compose
  semantics are non-trivial; reusing the CLI is correct and boring.
- **Stats** stream over a single WebSocket; the dashboard updates in place.

## Project layout

```
.
├── backend/                 FastAPI app
│   ├── app/
│   │   ├── main.py          app factory, static-file mount
│   │   ├── api.py           HTTP + WS routes
│   │   ├── docker_service.py  docker-py + `docker compose` wrapper
│   │   ├── discovery.py     filesystem scan
│   │   ├── models.py        response shapes (pydantic)
│   │   └── config.py        env-driven settings
│   └── requirements.txt
├── frontend/                React + Vite + TS
│   ├── src/
│   │   ├── pages/           Dashboard, StackDetail
│   │   ├── components/      StackCard, MetricBar, StatePill, …
│   │   ├── hooks/           useLiveStats (WS)
│   │   └── lib/             api client, formatters
│   └── package.json
├── Dockerfile               2-stage: build frontend, ship Python runtime
├── docker-compose.example.yml  copy-paste self-host file
├── .env.example
├── Makefile                 buildx + dev helpers
└── .github/workflows/publish.yml
```

## Local development

```sh
# backend (uses your existing .venv)
.venv/bin/pip install -r backend/requirements.txt
(cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8765)

# frontend (separate terminal)
(cd frontend && npm install && npm run dev)
```

Vite serves on `:5173` and proxies `/api` + `/api/ws` to FastAPI on `:8765`,
so you can hit <http://localhost:5173> and everything Just Works.

Or:

```sh
make dev          # runs both in one shell
```

## Adding a new feature — the 60-second tour

The code is small on purpose. To add a new stack action, e.g. "pause":

1. **Backend** — add an endpoint in `backend/app/api.py`:
   ```python
   @router.post("/stacks/{name}/pause", response_model=ActionResult)
   async def stack_pause(name: str):
       return await _run_action(name, "pause")
   ```
2. **Frontend** — add a call in `frontend/src/lib/api.ts` and an
   `<ActionButton>` in `pages/StackDetail.tsx`.

That's it — no codegen, no DI container, no plugin system.

## Roadmap

- [ ] Update detection (compare running image digest vs registry)
- [ ] Streaming logs over WebSocket (currently polled)
- [ ] Per-container CPU / memory drill-down
- [ ] Env-file editor for stacks
- [ ] Auth (single-user PIN, then OIDC)

## License

MIT.
