import { motion } from "framer-motion";

import type { ContainerInfo } from "@/lib/api";

const STATE_COLOR: Record<string, string> = {
  running:    "bg-good",
  restarting: "bg-warn",
  paused:     "bg-warn",
  exited:     "bg-dim",
  dead:       "bg-bad",
  created:    "bg-dim",
};

export default function ContainerRow({ c }: { c: ContainerInfo }) {
  const dot = STATE_COLOR[c.state] ?? "bg-dim";
  return (
    <motion.div
      layout
      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 px-4 py-3 border-b border-line/60 last:border-0"
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.service || c.name}</span>
          <span className="text-dim text-xs">{c.name}</span>
        </div>
        <div className="text-xs text-dim font-mono truncate">{c.image}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-dim">{c.status}</div>
        {c.ports.length > 0 && (
          <div className="text-[11px] font-mono text-accent/80 mt-0.5">
            {c.ports.join("  ·  ")}
          </div>
        )}
      </div>
    </motion.div>
  );
}
