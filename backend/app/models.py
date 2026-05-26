"""Pydantic response models — these are the JSON shapes the frontend consumes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

StackState = Literal["running", "stopped", "partial", "unknown"]


class ContainerInfo(BaseModel):
    id: str
    name: str
    service: str            # compose service name (web, db, …)
    image: str
    state: str              # raw docker state: running, exited, restarting…
    status: str             # human string: "Up 3 hours", "Exited (0) 2 days ago"
    ports: list[str] = []


class StackSummary(BaseModel):
    """Lightweight record for the dashboard grid."""

    name: str
    path: str
    state: StackState
    services_total: int
    services_running: int
    cpu_percent: float = 0.0
    memory_bytes: int = 0
    memory_limit_bytes: int = 0


class StackDetail(StackSummary):
    """Full record for the stack detail view."""

    compose_file: str
    containers: list[ContainerInfo]


class StatsTick(BaseModel):
    """One sample broadcast over the /ws/stats websocket."""

    stack: str
    cpu_percent: float
    memory_bytes: int
    memory_limit_bytes: int


class ActionResult(BaseModel):
    ok: bool
    stdout: str = ""
    stderr: str = ""
