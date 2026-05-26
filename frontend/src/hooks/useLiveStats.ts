import { useEffect, useState } from "react";

import { openStatsSocket, type StatsTick } from "@/lib/api";

/**
 * Subscribes to the live stats websocket and exposes the latest tick per stack name.
 * Reconnects with a small backoff if the socket drops.
 */
export function useLiveStats(): Record<string, StatsTick> {
  const [bag, setBag] = useState<Record<string, StatsTick>>({});

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryMs = 1_000;

    const connect = () => {
      ws = openStatsSocket((ticks) => {
        setBag((prev) => {
          const next = { ...prev };
          for (const t of ticks) next[t.stack] = t;
          return next;
        });
        retryMs = 1_000; // healthy traffic → reset backoff
      });
      ws.onclose = () => {
        if (closed) return;
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 10_000);
      };
    };

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, []);

  return bag;
}
