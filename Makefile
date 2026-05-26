# ───────── Docklet — build & publish ───────────────────────────────────────────
#   make image         build a local single-arch image (no push)
#   make push          build + push multi-arch :vX.Y.Z AND :latest,
#                      then bump VERSION's patch number for next time
#   make buildx-init   create the buildx builder (run once per machine)
#   make dev           run backend (uvicorn) + frontend (vite) locally
#
# Current version lives in ./VERSION. Bump major/minor by editing it by hand.
# ───────────────────────────────────────────────────────────────────────────────

REGISTRY  ?= drevoliv/docket
IMAGE     ?= docklet
PLATFORMS ?= linux/amd64,linux/arm64

VERSION = $(shell cat VERSION)
TAGS    = -t $(REGISTRY)/$(IMAGE):v$(VERSION) -t $(REGISTRY)/$(IMAGE):latest

.PHONY: help image push buildx-init dev

help:
	@echo "make image          local build, tagged $(IMAGE):v$(VERSION)"
	@echo "make push           build + push :v$(VERSION) and :latest, then bump VERSION"
	@echo "make buildx-init    one-time buildx setup"
	@echo "make dev            run backend + frontend"

image:
	docker build -t $(IMAGE):v$(VERSION) .

buildx-init:
	docker buildx create --name docklet-builder --use || docker buildx use docklet-builder
	docker buildx inspect --bootstrap

push:
	docker buildx build --platform $(PLATFORMS) $(TAGS) --push .
	@awk -F. '{printf "%d.%d.%d\n", $$1, $$2, $$3+1}' VERSION > VERSION.tmp && mv VERSION.tmp VERSION
	@echo "Pushed v$(VERSION). Next version → $$(cat VERSION)"

dev:
	@echo "Backend :8765, frontend :5173 (proxies /api). Open http://localhost:5173"
	(cd backend && ../.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8765) & \
	(cd frontend && npm run dev) ; \
	wait
