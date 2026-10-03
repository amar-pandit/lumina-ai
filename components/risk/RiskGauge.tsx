"use client";

import { motion } from "framer-motion";

interface RiskGaugeProps {
  score: number;
  category: "SAFE" | "MODERATE" | "CRITICAL";
}

const categoryColors: Record<RiskGaugeProps["category"], { accent: string; glow: string }> = {
  SAFE: { accent: "#10B981", glow: "shadow-emerald-500/30" },
  MODERATE: { accent: "#F59E0B", glow: "shadow-amber-500/30" },
  CRITICAL: { accent: "#F43F5E", glow: "shadow-rose-500/30" },
};

export function RiskGauge({ score, category }: RiskGaugeProps) {
  const colors = categoryColors[category];

  return (
    <div
      className="flex flex-col items-center justify-center rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-8"
      role="img"
      aria-label={`Academic risk gauge: ${score.toFixed(1)} percent, ${category}`}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative flex h-52 w-52 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${colors.accent} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          boxShadow: `0 0 30px ${colors.accent}33`,
        }}
      >
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-zinc-950/95 ring-1 ring-zinc-800">
          <span className="text-5xl font-semibold text-white">{score.toFixed(1)}</span>
          <span className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-400">Risk</span>
        </div>
      </motion.div>
      <div className="mt-5 rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white">
        {category}
      </div>
    </div>
  );
}
