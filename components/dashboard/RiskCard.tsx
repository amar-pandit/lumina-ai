"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

interface RiskCardProps {
  score: number;
  category: "SAFE" | "MODERATE" | "CRITICAL";
}

const statusStyles: Record<RiskCardProps["category"], { text: string; pill: string; ring: string }> = {
  SAFE: { text: "SAFE", pill: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40", ring: "#10B981" },
  MODERATE: { text: "MODERATE", pill: "bg-amber-500/10 text-amber-300 border-amber-500/40", ring: "#F59E0B" },
  CRITICAL: { text: "CRITICAL", pill: "bg-rose-500/10 text-rose-300 border-rose-500/40", ring: "#F43F5E" },
};

export function RiskCard({ score, category }: RiskCardProps) {
  const palette = statusStyles[category];
  const interventionPriority = category === "CRITICAL"
    ? "Immediate intervention"
    : category === "MODERATE"
      ? "Focused monitoring"
      : "Maintain progress";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">Academic Risk</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-4xl font-semibold tracking-[-0.06em] text-white">{score.toFixed(1)}</span>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${palette.pill}`}>
              {palette.text}
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-400">Intervention priority: {interventionPriority}</p>
        </div>

        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${palette.ring} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
            boxShadow: `0 0 25px ${palette.ring}30`,
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 ring-1 ring-zinc-800">
            {score >= 65 ? <AlertTriangle className="h-6 w-6 text-rose-300" /> : <ShieldCheck className="h-6 w-6 text-emerald-300" />}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Priority</p>
          <p className="mt-1 text-sm font-medium text-white">{interventionPriority}</p>
        </div>
        <Link
          href="/student/risk"
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:border-indigo-400 hover:bg-indigo-500/20"
        >
          Why?
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
