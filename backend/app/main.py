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

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Anything that didn't match an API route → serve index.html so the
        # React router can take over.
        index = settings.frontend_dist / "index.html"
        return FileResponse(index)
