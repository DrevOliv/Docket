from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import router as api_router
from app.config import settings
from app.docker_service import docker_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    docker_service.connect()
    yield
    docker_service.close()


app = FastAPI(title="Docklet", lifespan=lifespan)

# Permissive CORS for local dev (Vite on :5173 calling FastAPI on :8765).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/healthz")
def healthz():
    return {"ok": True}


# Serve the built React app, if present. In dev you'll hit Vite directly on :5173,
# so missing static files isn't an error — just skip mounting.
if settings.frontend_dist.exists():
    assets_dir = settings.frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    _dist_root = settings.frontend_dist.resolve()
    _index_html = _dist_root / "index.html"

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Vite copies everything under frontend/public/ into dist/ at the root
        # (favicon, logo PNGs, etc). If the request maps to a real file there,
        # serve it; otherwise fall back to index.html so the React router can
        # take over the client-side route.
        if full_path:
            candidate = (_dist_root / full_path).resolve()
            if (
                candidate.is_file()
                and candidate.is_relative_to(_dist_root)  # block ../ traversal
            ):
                return FileResponse(candidate)
        return FileResponse(_index_html)
