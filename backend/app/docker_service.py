"""Wraps the Docker SDK so the rest of the app stays simple.

Two responsibilities:
  1. Read state — list containers for a compose project, compute CPU/memory stats.
  2. Run actions — shell out to `docker compose` for up/down/restart/pull.

We shell out for compose actions instead of re-implementing compose semantics
ourselves. The Docker SDK doesn't expose compose; the CLI does it correctly.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Iterable

import docker
from docker.errors import DockerException
from docker.models.containers import Container

from app.config import settings
from app.discovery import DiscoveredStack
from app.models import ContainerInfo, StackState

log = logging.getLogger(__name__)

COMPOSE_PROJECT_LABEL = "com.docker.compose.project"
COMPOSE_SERVICE_LABEL = "com.docker.compose.service"


@dataclass
class StackRuntime:
    """Aggregated runtime state for one compose project."""

    containers: list[ContainerInfo]
    cpu_percent: float
    memory_bytes: int
    memory_limit_bytes: int

    @property
    def services_total(self) -> int:
        return len(self.containers)

    @property
    def services_running(self) -> int:
        return sum(1 for c in self.containers if c.state == "running")

    @property
    def state(self) -> StackState:
        if not self.containers:
            return "stopped"
        running = self.services_running
        if running == 0:
            return "stopped"
        if running == self.services_total:
            return "running"
        return "partial"


class DockerService:
    def __init__(self) -> None:
        self._client: docker.DockerClient | None = None

    # ---- lifecycle -------------------------------------------------------

    def connect(self) -> None:
        try:
            self._client = (
                docker.DockerClient(base_url=settings.docker_host)
                if settings.docker_host
                else docker.from_env()
            )
            self._client.ping()
            log.info("Connected to Docker daemon")
        except DockerException as e:
            log.warning("Could not connect to Docker daemon: %s", e)
            self._client = None

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None

    @property
    def client(self) -> docker.DockerClient:
        if self._client is None:
            raise RuntimeError("Docker client not connected")
        return self._client

    # ---- read state ------------------------------------------------------

    def list_project_containers(self, project: str) -> list[Container]:
        return self.client.containers.list(
            all=True,
            filters={"label": f"{COMPOSE_PROJECT_LABEL}={project}"},
        )

    def get_runtime(self, stack: DiscoveredStack, *, with_stats: bool = False) -> StackRuntime:
        try:
            containers = self.list_project_containers(stack.name)
        except DockerException as e:
            log.warning("docker list failed for %s: %s", stack.name, e)
            return StackRuntime([], 0.0, 0, 0)

        infos = [_container_info(c) for c in containers]

        cpu = 0.0
        mem = 0
        mem_limit = 0
        if with_stats:
            for c in containers:
                if c.status != "running":
                    continue
                stats = _safe_stats(c)
                if stats is None:
                    continue
                cpu += _calc_cpu_percent(stats)
                mem += _read_int(stats, "memory_stats", "usage")
                mem_limit += _read_int(stats, "memory_stats", "limit")

        return StackRuntime(infos, cpu, mem, mem_limit)

    async def get_runtime_async(self, stack: DiscoveredStack, *, with_stats: bool = False) -> StackRuntime:
        # docker-py is sync; offload to a thread so we don't block the event loop.
        return await asyncio.to_thread(self.get_runtime, stack, with_stats=with_stats)

    # ---- actions ---------------------------------------------------------

    async def compose(self, stack: DiscoveredStack, *args: str) -> tuple[int, str, str]:
        """Run compose against this stack and capture output.

        In the shipped image `compose_bin` points at the standalone
        docker-compose binary. For local dev outside the container we accept
        a space-separated value like "docker compose" (the CLI plugin form).
        """
        cmd = [
            *settings.compose_bin.split(),
            "-f", str(stack.compose_file),
            "-p", stack.name,
            *args,
        ]
        log.info("compose: %s", " ".join(cmd))
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(stack.path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_b, stderr_b = await proc.communicate()
        return proc.returncode or 0, stdout_b.decode(errors="replace"), stderr_b.decode(errors="replace")


# ----- module-level helpers ---------------------------------------------------


def _container_info(c: Container) -> ContainerInfo:
    labels = c.labels or {}
    service = labels.get(COMPOSE_SERVICE_LABEL, "")
    # docker-py reports c.ports as a dict like {"80/tcp": [{"HostIp":"0.0.0.0","HostPort":"8080"}]}
    ports: list[str] = []
    for container_port, bindings in (c.ports or {}).items():
        if bindings:
            for b in bindings:
                host = b.get("HostPort", "")
                ports.append(f"{host}→{container_port}" if host else container_port)
        else:
            ports.append(container_port)

    return ContainerInfo(
        id=c.short_id,
        name=c.name,
        service=service,
        image=(c.image.tags[0] if c.image and c.image.tags else (c.attrs.get("Config", {}).get("Image", ""))),
        state=c.status,
        status=c.attrs.get("State", {}).get("Status", c.status),
        ports=ports,
    )


def _safe_stats(c: Container) -> dict | None:
    try:
        return c.stats(stream=False)
    except DockerException:
        return None


def _read_int(d: dict, *keys: str) -> int:
    cur: object = d
    for k in keys:
        if not isinstance(cur, dict):
            return 0
        cur = cur.get(k, 0)
    return int(cur) if isinstance(cur, (int, float)) else 0


def _calc_cpu_percent(stats: dict) -> float:
    """Replicate docker stats' CPU% calculation from a single sample."""
    cpu = stats.get("cpu_stats", {}) or {}
    pre = stats.get("precpu_stats", {}) or {}

    cpu_total = (cpu.get("cpu_usage") or {}).get("total_usage", 0)
    pre_total = (pre.get("cpu_usage") or {}).get("total_usage", 0)
    cpu_system = cpu.get("system_cpu_usage", 0)
    pre_system = pre.get("system_cpu_usage", 0)

    cpu_delta = cpu_total - pre_total
    system_delta = cpu_system - pre_system

    online = cpu.get("online_cpus") or len((cpu.get("cpu_usage") or {}).get("percpu_usage") or []) or 1

    if cpu_delta > 0 and system_delta > 0:
        return (cpu_delta / system_delta) * online * 100.0
    return 0.0


def collect_running_stats(rt_list: Iterable[StackRuntime]) -> tuple[float, int, int]:
    cpu = sum(r.cpu_percent for r in rt_list)
    mem = sum(r.memory_bytes for r in rt_list)
    mem_lim = sum(r.memory_limit_bytes for r in rt_list)
    return cpu, mem, mem_lim


docker_service = DockerService()
