import { motion } from "framer-motion";
import type { StackState } from "@/lib/api";

const PALETTE: Record<StackState, { dot: string; bg: string; text: string; label: string }> = {
  running: { dot: "bg-good",  bg: "bg-good/10  border-good/30",  text: "text-good",  label: "running" },
  partial: { dot: "bg-warn",  bg: "bg-warn/10  border-warn/30",  text: "text-warn",  label: "partial" },
  stopped: { dot: "bg-dim",   bg: "bg-dim/10   border-line",     text: "text-dim",   label: "stopped" },
  unknown: { dot: "bg-bad",   bg: "bg-bad/10   border-bad/30",   text: "text-bad",   label: "unknown" },
};

export default function StatePill({ state }: { state: StackState }) {
  const p = PALETTE[state];
  return (
    <span className={`pill border ${p.bg} ${p.text}`}>
      <motion.span
        className={`w-1.5 h-1.5 rounded-full ${p.dot}`}
        animate={state === "running" ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
        transition={state === "running" ? { duration: 1.8, repeat: Infinity } : undefined}
      />
      {p.label}
    </span>
  );
}
