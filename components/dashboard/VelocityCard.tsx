import { TrendingDown } from "lucide-react";

interface VelocityCardProps {
  value: number;
  label: string;
}

export function VelocityCard({ value, label }: VelocityCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Academic Velocity</p>
        <div className="rounded-full bg-rose-500/10 p-2 text-rose-300">
          <TrendingDown className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-semibold text-white">{value.toFixed(2)}</span>
        <span className="mb-1 text-sm text-zinc-400">{label}</span>
      </div>
    </div>
  );
}
