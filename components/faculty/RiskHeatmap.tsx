interface HeatmapRow {
  subject: string;
  values: number[];
}

interface RiskHeatmapProps {
  data: HeatmapRow[];
}

const getCellStyle = (value: number) => {
  if (value >= 80) return "bg-rose-500/25 text-rose-100 border border-rose-500/30";
  if (value >= 70) return "bg-amber-500/20 text-amber-100 border border-amber-500/30";
  if (value >= 60) return "bg-cyan-500/15 text-cyan-100 border border-cyan-500/30";
  return "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30";
};

export function RiskHeatmap({ data }: RiskHeatmapProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h3 className="mb-4 text-lg font-semibold text-white">Risk Heatmap by Subject</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-2 text-xs text-zinc-400">
            <div className="px-2 py-3">Subject</div>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="px-2 py-3 text-center">W{index + 1}</div>
            ))}

            {data.map((row) => (
              <div key={row.subject} className="contents">
                <div className="flex items-center px-2 py-3 text-sm text-zinc-200">{row.subject}</div>
                {row.values.map((value, index) => (
                  <div
                    key={`${row.subject}-cell-${index}`}
                    className={`flex h-12 items-center justify-center rounded-xl text-xs font-medium ${getCellStyle(value)}`}
                  >
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
