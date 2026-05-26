n
# ─── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-fund --no-audit
COPY frontend/ ./
RUN npm run build


# ─── Stage 2: fetch the compose binary ───────────────────────────────────────
# We don't need the full Docker CLI — just `docker-compose`. It's a single static
# binary published on GitHub releases. ~60MB instead of ~250MB for docker-ce-cli.
FROM alpine:3.20 AS compose
ARG COMPOSE_VERSION=v2.32.1
RUN apk add --no-cache curl \
 && case "$TARGETARCH" in \
        amd64) arch=x86_64 ;; \
        arm64) arch=aarch64 ;; \
        *) echo "unsupported arch: $TARGETARCH" && exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${arch}" \
      -o /docker-compose \
 && chmod +x /docker-compose


# ─── Stage 3: runtime image ──────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY --from=compose  /docker-compose /usr/local/bin/docker-compose
COPY --from=frontend /app/dist       /app/static
COPY backend/app                     /app/app

ENV DOCKLET_FRONTEND_DIST=/app/static \
    DOCKLET_STACKS_DIR=/stacks \
    DOCKLET_HOST=0.0.0.0 \
    DOCKLET_PORT=8765 \
    DOCKLET_COMPOSE_BIN=/usr/local/bin/docker-compose \
    PYTHONUNBUFFERED=1

EXPOSE 8765
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]
