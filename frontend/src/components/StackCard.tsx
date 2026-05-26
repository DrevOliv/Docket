import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Boxes, ChevronRight, Cpu, MemoryStick } from "lucide-react";

import MetricBar from "@/components/MetricBar";
import StatePill from "@/components/StatePill";
import type { StackSummary, StatsTick } from "@/lib/api";
import { bytes, hashHue } from "@/lib/format";

interface Props {
  stack: StackSummary;
  tick?: StatsTick;          // latest live stats sample, if any
}

export default function StackCard({ stack, tick }: Props) {
  const cpu = tick?.cpu_percent ?? stack.cpu_percent ?? 0;
  const memBytes = tick?.memory_bytes ?? stack.memory_bytes ?? 0;
  const memLimit = tick?.memory_limit_bytes ?? stack.memory_limit_bytes ?? 0;
  const memPct = memLimit > 0 ? (memBytes / memLimit) * 100 : 0;
  const hue = hashHue(stack.name);

  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <Link
        to={`/stacks/${encodeURIComponent(stack.name)}`}
        className="card card-hover block p-5 group relative overflow-hidden"
      >
        {/* subtle colored glow per-stack */}
        <span
          aria-hidden
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: `hsl(${hue} 80% 60%)` }}
        />

        <div className="flex items-start justify-between gap-3 relative">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="grid place-items-center w-7 h-7 rounded-lg border border-line/70"
                style={{
                  background: `hsl(${hue} 60% 18%)`,
                  color: `hsl(${hue} 80% 75%)`,
                }}
              >
                <Boxes size={14} />
              </span>
              <h3 className="font-semibold tracking-tight truncate">{stack.name}</h3>
            </div>
            <p className="text-xs text-dim mt-1 truncate">{stack.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatePill state={stack.state} />
            <ChevronRight size={16} className="text-dim group-hover:text-accent transition-colors" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 relative">
          <MetricBar
            label="CPU"
            value={Math.min(cpu, 100)}
            caption={`${cpu.toFixed(1)}%`}
            tone={cpu > 80 ? "bad" : cpu > 50 ? "warn" : "accent"}
          />
          <MetricBar
            label="Memory"
            value={memPct}
            caption={memLimit > 0 ? `${bytes(memBytes)} / ${bytes(memLimit)}` : bytes(memBytes)}
            tone={memPct > 80 ? "bad" : memPct > 60 ? "warn" : "accent"}
          />
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-dim relative">
          <span className="flex items-center gap-1.5">
            <Cpu size={12} /> {stack.services_running}/{stack.services_total} services
          </span>
          <span className="flex items-center gap-1.5">
            <MemoryStick size={12} /> {bytes(memBytes)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
