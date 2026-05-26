import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CircleStop,
  DownloadCloud,
  FolderOpen,
  Play,
  RotateCw,
} from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ContainerRow from "@/components/ContainerRow";
import LogsPanel from "@/components/LogsPanel";
import MetricBar from "@/components/MetricBar";
import StatePill from "@/components/StatePill";
import { useLiveStats } from "@/hooks/useLiveStats";
import { bytes, hashHue } from "@/lib/format";
import { getStack, stackAction } from "@/lib/api";

type Action = "up" | "down" | "restart" | "pull";

export default function StackDetail() {
  const { name = "" } = useParams();
  const qc = useQueryClient();
  const live = useLiveStats();
  const [confirm, setConfirm] = useState<Action | null>(null);

  const { data: stack, isLoading } = useQuery({
    queryKey: ["stack", name],
    queryFn: () => getStack(name),
    refetchInterval: 5_000,
  });

  const mutation = useMutation({
    mutationFn: (action: Action) => stackAction(name, action),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["stack", name] });
      qc.invalidateQueries({ queryKey: ["stacks"] });
    },
  });

  const run = (action: Action, requiresConfirm = false) => {
    if (requiresConfirm && confirm !== action) {
      setConfirm(action);
      return;
    }
    setConfirm(null);
    mutation.mutate(action);
  };

  if (isLoading || !stack) return <DetailSkeleton />;

  const tick = live[stack.name];
  const cpu = tick?.cpu_percent ?? stack.cpu_percent;
  const mem = tick?.memory_bytes ?? stack.memory_bytes;
  const memLimit = tick?.memory_limit_bytes ?? stack.memory_limit_bytes;
  const memPct = memLimit > 0 ? (mem / memLimit) * 100 : 0;
  const hue = hashHue(stack.name);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-dim text-sm inline-flex items-center gap-1 hover:text-accent transition-colors">
          <ArrowLeft size={14} /> All stacks
        </Link>
      </div>

      {/* Header card */}
      <motion.div
        layoutId={`stack-${stack.name}`}
        className="card p-6 relative overflow-hidden"
      >
        <span
          aria-hidden
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: `hsl(${hue} 80% 60%)` }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{stack.name}</h1>
              <StatePill state={stack.state} />
            </div>
            <p className="text-xs text-dim mt-1 font-mono flex items-center gap-1.5">
              <FolderOpen size={12} /> {stack.compose_file}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              tone="primary"
              icon={<Play size={14} />}
              label="Start"
              busy={mutation.isPending && mutation.variables === "up"}
              onClick={() => run("up")}
            />
            <ActionButton
              icon={<RotateCw size={14} />}
              label="Restart"
              busy={mutation.isPending && mutation.variables === "restart"}
              onClick={() => run("restart")}
            />
            <ActionButton
              icon={<DownloadCloud size={14} />}
              label="Update"
              busy={mutation.isPending && mutation.variables === "pull"}
              onClick={() => run("pull")}
            />
            <ActionButton
              tone="danger"
              icon={<CircleStop size={14} />}
              label={confirm === "down" ? "Click again to confirm" : "Stop"}
              busy={mutation.isPending && mutation.variables === "down"}
              onClick={() => run("down", true)}
            />
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-6 relative">
          <MetricBar
            label="CPU"
            value={Math.min(cpu, 100)}
            caption={`${cpu.toFixed(1)}%`}
            tone={cpu > 80 ? "bad" : cpu > 50 ? "warn" : "accent"}
          />
          <MetricBar
            label="Memory"
            value={memPct}
            caption={memLimit > 0 ? `${bytes(mem)} / ${bytes(memLimit)}` : bytes(mem)}
            tone={memPct > 80 ? "bad" : memPct > 60 ? "warn" : "accent"}
          />
        </div>
      </motion.div>

      {/* Action result toast */}
      {mutation.data && !mutation.isPending && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card px-4 py-3 text-sm ${mutation.data.ok ? "border-good/30" : "border-bad/30"}`}
        >
          {mutation.data.ok ? (
            <span className="text-good">Action completed.</span>
          ) : (
            <span className="text-bad">Action failed — see logs:</span>
          )}
          {(mutation.data.stderr || !mutation.data.ok) && (
            <pre className="text-[12px] font-mono text-dim mt-2 whitespace-pre-wrap">
              {mutation.data.stderr || mutation.data.stdout}
            </pre>
          )}
        </motion.div>
      )}

      {/* Services */}
      <motion.div layout className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line/60 flex items-center justify-between">
          <h3 className="font-semibold">Services</h3>
          <span className="text-xs text-dim">
            {stack.services_running} / {stack.services_total} running
          </span>
        </div>
        {stack.containers.length === 0 ? (
          <div className="text-dim text-sm px-4 py-6 text-center">
            No containers — start the stack to bring services up.
          </div>
        ) : (
          stack.containers.map((c) => <ContainerRow key={c.id} c={c} />)
        )}
      </motion.div>

      <LogsPanel stackName={stack.name} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="card p-6">
        <div className="h-6 w-1/3 bg-ink-muted rounded mb-3" />
        <div className="h-3 w-2/3 bg-ink-muted rounded" />
        <div className="h-2 w-full bg-ink-muted rounded mt-8" />
      </div>
      <div className="card h-40" />
    </div>
  );
}
