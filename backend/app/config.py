from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DOCKLET_", env_file=".env")

    # Root directory scanned for compose projects. Each subfolder containing
    # docker-compose.yml (or compose.yaml) becomes a managed stack.
    stacks_dir: Path = Path("/stacks")

    # Where the built React frontend lives (served as static files).
    frontend_dist: Path = Path(__file__).resolve().parent.parent / "static"

    # Bind address for uvicorn.
    host: str = "0.0.0.0"
    port: int = 8765

    # Docker daemon URL. None → use default unix socket.
    docker_host: str | None = None

    # Path to the standalone docker-compose binary. The Dockerfile bakes it in
    # at /usr/local/bin/docker-compose. For local dev (running outside the
    # container) we fall back to "docker compose" via the Docker CLI plugin.
    compose_bin: str = "docker-compose"


settings = Settings()
