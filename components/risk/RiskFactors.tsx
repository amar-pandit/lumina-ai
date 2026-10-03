interface RiskFactorItem {
  title: string;
  value: string;
  impact: number;
  tone: "rose" | "amber" | "violet" | "emerald";
}

interface RiskFactorsProps {
  factors: RiskFactorItem[];
}

const toneClasses: Record<RiskFactorItem["tone"], string> = {
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/40",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/40",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
};

const barTone: Record<RiskFactorItem["tone"], string> = {
  rose: "from-rose-500 to-rose-400",
  amber: "from-amber-500 to-yellow-400",
  violet: "from-violet-500 to-indigo-400",
  emerald: "from-emerald-500 to-cyan-400",
};

export function RiskFactors({ factors }: RiskFactorsProps) {
  return (
    <div className="space-y-4">
      {factors.map((factor) => {
        const width = Math.max(8, Math.min(100, Math.abs(factor.impact) * 2.5));

        return (
          <div key={factor.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{factor.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{factor.value}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${toneClasses[factor.tone]}`}>
                {factor.impact > 0 ? `+${factor.impact} risk` : `${factor.impact} risk`}
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barTone[factor.tone]}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
