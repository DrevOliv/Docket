"""Find docker-compose projects on disk.

A "stack" = one folder containing a compose file. The stack's identifier is the
Docker Compose **project name**, which is what gets stamped onto running
containers via the `com.docker.compose.project` label and is how we correlate
folders to containers.

We resolve the project name the same way the compose CLI does, so Docklet
matches whatever name your containers were actually started with:

  1. top-level `name:` in the compose file
  2. `COMPOSE_PROJECT_NAME` in a `.env` file next to the compose file
  3. folder basename, normalized (lowercase, non-[a-z0-9_-] → `_`)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from app.config import settings

log = logging.getLogger(__name__)

COMPOSE_FILENAMES = ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")

_INVALID_NAME_CHARS = re.compile(r"[^a-z0-9_-]+")


@dataclass(frozen=True)
class DiscoveredStack:
    name: str           # resolved compose project name (used for label correlation)
    path: Path          # folder path
    compose_file: Path  # path to the compose file inside the folder


def _find_compose_file(folder: Path) -> Path | None:
    for filename in COMPOSE_FILENAMES:
        candidate = folder / filename
        if candidate.is_file():
            return candidate
    return None


def _sanitize_project_name(raw: str) -> str:
    """Approximate the compose CLI's project-name normalization."""
    cleaned = _INVALID_NAME_CHARS.sub("_", raw.lower()).strip("_")
    return cleaned or raw


def _name_from_compose_file(compose_file: Path) -> str | None:
    try:
        with compose_file.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except (OSError, yaml.YAMLError) as e:
        log.warning("could not parse %s for project name: %s", compose_file, e)
        return None
    if not isinstance(data, dict):
        return None
    name = data.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _name_from_env_file(env_file: Path) -> str | None:
    if not env_file.is_file():
        return None
    try:
        text = env_file.read_text(encoding="utf-8")
    except OSError as e:
        log.warning("could not read %s: %s", env_file, e)
        return None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, sep, value = stripped.partition("=")
        if sep and key.strip() == "COMPOSE_PROJECT_NAME":
            value = value.strip().strip('"').strip("'")
            if value:
                return value
    return None


def _resolve_project_name(folder: Path, compose_file: Path) -> str:
    return (
        _name_from_compose_file(compose_file)
        or _name_from_env_file(folder / ".env")
        or _sanitize_project_name(folder.name)
    )


def discover_stacks() -> list[DiscoveredStack]:
    """List every immediate subfolder of STACKS_DIR that has a compose file."""
    root = settings.stacks_dir
    if not root.is_dir():
        return []

    stacks: list[DiscoveredStack] = []
    for entry in sorted(root.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        compose = _find_compose_file(entry)
        if compose is None:
            continue
        project = _resolve_project_name(entry, compose)
        stacks.append(DiscoveredStack(name=project, path=entry, compose_file=compose))
    return stacks


def get_stack(name: str) -> DiscoveredStack | None:
    for stack in discover_stacks():
        if stack.name == name:
            return stack
    return None
