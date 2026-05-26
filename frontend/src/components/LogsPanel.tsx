import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RefreshCw, ScrollText } from "lucide-react";

import { getLogs } from "@/lib/api";

interface Props {
  stackName: string;
  tail?: number;
}

export default function LogsPanel({ stackName, tail = 200 }: Props) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["logs", stackName, tail],
    queryFn: () => getLogs(stackName, tail),
    refetchInterval: 5_000,
  });

  return (
    <motion.div layout className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-accent" />
          <h3 className="font-semibold">Logs</h3>
          <span className="text-xs text-dim">tail {tail}</span>
        </div>
        <button className="btn" onClick={() => refetch()}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      <pre className="text-[12px] leading-relaxed font-mono p-4 max-h-[420px] overflow-auto whitespace-pre-wrap">
        {data?.logs?.trim() || (isFetching ? "Loading…" : "No logs yet.")}
      </pre>
    </motion.div>
  );
}
