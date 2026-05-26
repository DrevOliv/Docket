"""Find docker-compose projects on disk.

A "stack" = one folder containing a compose file. The folder name is the stack name
(also the Docker Compose project name, which is how we correlate to running
containers via the `com.docker.compose.project` label).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.config import settings

COMPOSE_FILENAMES = ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")


@dataclass(frozen=True)
class DiscoveredStack:
    name: str           # folder name == compose project name
    path: Path          # folder path
    compose_file: Path  # path to the compose file inside the folder


def _find_compose_file(folder: Path) -> Path | None:
    for filename in COMPOSE_FILENAMES:
        candidate = folder / filename
        if candidate.is_file():
            return candidate
    return None


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
        stacks.append(DiscoveredStack(name=entry.name, path=entry, compose_file=compose))
    return stacks


def get_stack(name: str) -> DiscoveredStack | None:
    for stack in discover_stacks():
        if stack.name == name:
            return stack
    return None
