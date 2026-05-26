"""HTTP + WebSocket API.

Routes are intentionally thin: parse path → call docker_service → return a model.
Any non-trivial logic belongs in docker_service.py or discovery.py.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.discovery import discover_stacks, get_stack
from app.docker_service import docker_service
from app.models import ActionResult, StackDetail, StackSummary, StatsTick

log = logging.getLogger(__name__)
router = APIRouter()


# ---- read --------------------------------------------------------------------


@router.get("/stacks", response_model=list[StackSummary])
async def list_stacks() -> list[StackSummary]:
    discovered = discover_stacks()
    # Parallelize per-stack queries so the dashboard loads fast even with many stacks.
    runtimes = await asyncio.gather(
        *(docker_service.get_runtime_async(s, with_stats=False) for s in discovered)
    )
    return [
        StackSummary(
            name=s.name,
            path=str(s.path),
            state=rt.state,
            services_total=rt.services_total,
            services_running=rt.services_running,
        )
        for s, rt in zip(discovered, runtimes)
    ]


@router.get("/stacks/{name}", response_model=StackDetail)
async def get_stack_detail(name: str) -> StackDetail:
    stack = get_stack(name)
    if stack is None:
        raise HTTPException(404, f"Stack '{name}' not found")
    rt = await docker_service.get_runtime_async(stack, with_stats=True)
    return StackDetail(
        name=stack.name,
        path=str(stack.path),
        compose_file=str(stack.compose_file),
        state=rt.state,
        services_total=rt.services_total,
        services_running=rt.services_running,
        cpu_percent=rt.cpu_percent,
        memory_bytes=rt.memory_bytes,
        memory_limit_bytes=rt.memory_limit_bytes,
        containers=rt.containers,
    )


@router.get("/stacks/{name}/logs")
async def get_stack_logs(name: str, tail: int = 200) -> dict:
    stack = get_stack(name)
    if stack is None:
        raise HTTPException(404, f"Stack '{name}' not found")
    rc, out, err = await docker_service.compose(stack, "logs", "--no-color", "--tail", str(tail))
    return {"ok": rc == 0, "logs": out or err}


# ---- actions -----------------------------------------------------------------


async def _run_action(name: str, *compose_args: str) -> ActionResult:
    stack = get_stack(name)
    if stack is None:
        raise HTTPException(404, f"Stack '{name}' not found")
    rc, out, err = await docker_service.compose(stack, *compose_args)
    return ActionResult(ok=rc == 0, stdout=out, stderr=err)


@router.post("/stacks/{name}/up", response_model=ActionResult)
async def stack_up(name: str) -> ActionResult:
    return await _run_action(name, "up", "-d")


@router.post("/stacks/{name}/down", response_model=ActionResult)
async def stack_down(name: str) -> ActionResult:
    return await _run_action(name, "down")


@router.post("/stacks/{name}/restart", response_model=ActionResult)
async def stack_restart(name: str) -> ActionResult:
    return await _run_action(name, "restart")


@router.post("/stacks/{name}/pull", response_model=ActionResult)
async def stack_pull(name: str) -> ActionResult:
    # Pull new images then re-up so containers actually run the new image.
    rc1, out1, err1 = await docker_service.compose(get_stack(name), "pull")  # type: ignore[arg-type]
    rc2, out2, err2 = await docker_service.compose(get_stack(name), "up", "-d")  # type: ignore[arg-type]
    return ActionResult(ok=(rc1 == 0 and rc2 == 0), stdout=out1 + out2, stderr=err1 + err2)


# ---- live metrics ------------------------------------------------------------


@router.websocket("/ws/stats")
async def ws_stats(ws: WebSocket) -> None:
    """Push a stats tick per stack every ~2 seconds.

    Sample-on-demand keeps things simple: the frontend opens the socket when the
    dashboard is visible and closes it when navigating away.
    """
    await ws.accept()
    try:
        while True:
            stacks = discover_stacks()
            runtimes = await asyncio.gather(
                *(docker_service.get_runtime_async(s, with_stats=True) for s in stacks)
            )
            ticks = [
                StatsTick(
                    stack=s.name,
                    cpu_percent=rt.cpu_percent,
                    memory_bytes=rt.memory_bytes,
                    memory_limit_bytes=rt.memory_limit_bytes,
                ).model_dump()
                for s, rt in zip(stacks, runtimes)
            ]
            await ws.send_text(json.dumps(ticks))
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        return
    except Exception as e:  # noqa: BLE001 — websocket loop is the boundary
        log.exception("ws_stats error: %s", e)
        await ws.close()
