"use client";

import { motion } from "framer-motion";
import { Topbar } from "@/components/layout/Topbar";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { RiskFactors } from "@/components/risk/RiskFactors";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getStudentRisk } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

const factorTone = (name: string): "rose" | "amber" | "violet" | "emerald" => {
  if (name.includes("Attendance")) return "amber";
  if (name.includes("velocity")) return "violet";
  if (name.includes("Lab")) return "emerald";
  return "rose";
};

export default function StudentRiskPage() {
  const [demoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const riskSnapshot = getStudentRisk(demoState);
  const leadingFactors = [...riskSnapshot.factors].sort((left, right) => right.contribution - left.contribution).slice(0, 2);
  const explanation = `Your current score is ${riskSnapshot.category.toLowerCase()} and is most influenced by ${leadingFactors.map((factor) => `${factor.name.toLowerCase()} (${factor.score})`).join(" and ")}. The recommendations below are generated from the same demo risk calculation.`;

  return (
    <div>
      <Topbar title="AI Academic Risk Analysis" subtitle="Demo Academic Risk Engine" />

      <main className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <RiskGauge score={riskSnapshot.score} category={riskSnapshot.category} />

          <div className="rounded-[30px] border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Current risk</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-5xl font-semibold tracking-[-0.06em] text-white">{riskSnapshot.score.toFixed(1)}</span>
              <span className={`mb-1 rounded-full border px-2 py-1 text-xs font-medium uppercase tracking-[0.2em] ${riskSnapshot.category === "CRITICAL" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : riskSnapshot.category === "MODERATE" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                {riskSnapshot.category}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold text-white">Why are you at risk?</h3>
              <RiskFactors
                factors={riskSnapshot.factors.map((factor) => ({ title: factor.name, value: factor.score, impact: Math.round(factor.contribution), tone: factorTone(factor.name) }))}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[30px] border border-zinc-800 bg-zinc-900/80 p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-white">AI Explanation</h3>
              <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-2 py-1 text-[10px] font-medium uppercase text-emerald-100">
                Demo Academic Risk Engine
              </span>
            </div>
            <p className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-base leading-7 text-zinc-200">
              {explanation}
            </p>
            <ul className="mt-4 space-y-2">{riskSnapshot.recommendations.map((recommendation) => <li key={recommendation} className="flex items-start gap-2 text-sm text-zinc-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-200" />{recommendation}</li>)}</ul>
          </motion.div>

          <div className="rounded-[30px] border border-zinc-800 bg-zinc-900/80 p-6">
            <h3 className="text-xl font-semibold text-white">Risk Score Breakdown</h3>
            <div className="mt-5 space-y-4">
              {riskSnapshot.factors.map((factor) => {
                const share = riskSnapshot.score === 0 ? 0 : (factor.contribution / riskSnapshot.score) * 100;
                return <div key={factor.name}>
                  <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
                    <span>{factor.name}</span>
                    <span>{factor.contribution.toFixed(1)} pts</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>;
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
