"use client";

import { motion } from "framer-motion";

interface RecoveryProgressProps {
  progress: number;
  currentRisk: number;
  projectedRisk: number;
}

export function RecoveryProgress({ progress, currentRisk, projectedRisk }: RecoveryProgressProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Recovery Progress</p>
          <p className="mt-1 text-3xl font-semibold text-white">{progress}%</p>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
          Risk: {currentRisk.toFixed(1)} → {projectedRisk.toFixed(1)}
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-400"
        />
      </div>
    </div>
  );
}
