/**
 * Tiny API client. All backend calls go through here so endpoints/types
 * live in one place.
 */
import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

// ----- types (mirror backend/app/models.py) -----------------------------------

export type StackState = "running" | "stopped" | "partial" | "unknown";

export interface StackSummary {
  name: string;
  path: string;
  state: StackState;
  services_total: number;
  services_running: number;
  cpu_percent: number;
  memory_bytes: number;
  memory_limit_bytes: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  service: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
}

export interface StackDetail extends StackSummary {
  compose_file: string;
  containers: ContainerInfo[];
}

export interface StatsTick {
  stack: string;
  cpu_percent: number;
  memory_bytes: number;
  memory_limit_bytes: number;
}

export interface ActionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

// ----- calls ------------------------------------------------------------------

export const listStacks = () => api.get<StackSummary[]>("/stacks").then(r => r.data);

export const getStack = (name: string) =>
  api.get<StackDetail>(`/stacks/${encodeURIComponent(name)}`).then(r => r.data);

export const getLogs = (name: string, tail = 200) =>
  api.get<{ ok: boolean; logs: string }>(
    `/stacks/${encodeURIComponent(name)}/logs`,
    { params: { tail } },
  ).then(r => r.data);

export const stackAction = (name: string, action: "up" | "down" | "restart" | "pull") =>
  api.post<ActionResult>(`/stacks/${encodeURIComponent(name)}/${action}`).then(r => r.data);

// ----- websocket --------------------------------------------------------------

export function openStatsSocket(onTick: (ticks: StatsTick[]) => void): WebSocket {
  // In dev the Vite proxy upgrades /ws → backend; in prod FastAPI serves it directly.
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${window.location.host}/api/ws/stats`);
  ws.onmessage = (e) => {
    try { onTick(JSON.parse(e.data)); } catch { /* ignore malformed tick */ }
  };
  return ws;
}
