interface AttendanceGaugeProps {
  value: number;
  label: string;
}

export function AttendanceGauge({ value, label }: AttendanceGaugeProps) {
  const progress = Math.min(value, 100);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-6"
      role="img"
      aria-label={`${label} attendance gauge: ${progress}%`}
    >
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full shadow-[0_0_30px_rgba(6,182,212,0.2)]"
        style={{
          background: `conic-gradient(#06B6D4 ${progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-950 ring-1 ring-zinc-800">
          <div className="text-center">
            <div className="text-3xl font-semibold text-white">{value.toFixed(0)}%</div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
