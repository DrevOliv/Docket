import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

import StackCard from "@/components/StackCard";
import { useLiveStats } from "@/hooks/useLiveStats";
import { listStacks } from "@/lib/api";

export default function Dashboard() {
  const { data: stacks, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["stacks"],
    queryFn: listStacks,
    refetchInterval: 10_000, // light polling — stats come via WS
  });
  const live = useLiveStats();

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Your stacks
            <Sparkles size={18} className="text-accent" />
          </h1>
          <p className="text-dim text-sm mt-1">
            {stacks ? `${stacks.length} compose project${stacks.length === 1 ? "" : "s"} discovered` : "Scanning…"}
          </p>
        </div>
        <button
          className="btn"
          onClick={() => refetch()}
          aria-label="Refresh stacks"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isError && <EmptyState kind="error" onRetry={() => refetch()} />}
      {!isError && !isLoading && stacks?.length === 0 && <EmptyState kind="empty" />}

      <motion.div
        layout
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {(stacks ?? []).map((s, i) => (
            <motion.div
              key={s.name}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
            >
              <StackCard stack={s} tick={live[s.name]} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {isLoading && <SkeletonGrid />}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-5 animate-pulse">
          <div className="h-4 w-1/3 bg-ink-muted rounded mb-2" />
          <div className="h-3 w-2/3 bg-ink-muted rounded mb-6" />
          <div className="h-2 w-full bg-ink-muted rounded mb-3" />
          <div className="h-2 w-full bg-ink-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ kind, onRetry }: { kind: "empty" | "error"; onRetry?: () => void }) {
  return (
    <div className="card p-10 text-center">
      <div className="grid place-items-center w-12 h-12 rounded-xl bg-warn/10 text-warn mx-auto mb-3">
        <AlertTriangle size={20} />
      </div>
      {kind === "empty" ? (
        <>
          <h2 className="font-semibold">No stacks found</h2>
          <p className="text-dim text-sm mt-2 max-w-md mx-auto">
            Drop a folder with a <code className="text-accent">docker-compose.yml</code> into your
            stacks directory (mounted at <code className="text-accent">/stacks</code> by default)
            and it'll appear here.
          </p>
        </>
      ) : (
        <>
          <h2 className="font-semibold">Couldn't reach the backend</h2>
          <p className="text-dim text-sm mt-2">Is the API running and the Docker socket mounted?</p>
          {onRetry && (
            <button className="btn mt-4" onClick={onRetry}>
              <RefreshCw size={14} /> Try again
            </button>
          )}
        </>
      )}
    </div>
  );
}
