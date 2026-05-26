import { motion } from "framer-motion";

interface Props {
  label: string;
  value: number;       // 0..100, percentage to fill
  caption?: string;    // small text on the right (e.g. "342 MB / 2 GB")
  tone?: "accent" | "warn" | "bad";
}

const TONES = {
  accent: "from-accent to-accent/40",
  warn:   "from-warn to-warn/40",
  bad:    "from-bad to-bad/40",
};

export default function MetricBar({ label, value, caption, tone = "accent" }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-[11px] text-dim mb-1">
        <span>{label}</span>
        <span className="font-mono">{caption ?? `${pct.toFixed(1)}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${TONES[tone]}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
