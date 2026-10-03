import { ArrowDownRight, ArrowUpRight, Users } from "lucide-react";

interface AttendanceCardProps {
  attendance: number;
  required: number;
  trend: number;
}

export function AttendanceCard({ attendance, required, trend }: AttendanceCardProps) {
  const ratio = Math.max(0, Math.min(attendance, 100));
  const shortfall = Math.max(0, required - attendance);
  const meetsRequirement = shortfall === 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Attendance</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-semibold text-white">{attendance}%</span>
            <span className="text-sm text-zinc-400">Required {required}%</span>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200/15 bg-emerald-300/[0.07] text-emerald-200">
          <Users className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span>Current status</span>
          <span className={`inline-flex items-center gap-1 ${trend >= 0 ? "text-emerald-200" : "text-rose-300"}`}>
            {trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {trend > 0 ? "+" : ""}{trend}% vs baseline
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Attendance percentage"
          aria-valuenow={ratio}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={`h-full rounded-full ${meetsRequirement ? "bg-gradient-to-r from-emerald-300 to-cyan-300" : "bg-gradient-to-r from-amber-300 to-rose-300"}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{meetsRequirement ? "Requirement met" : `${shortfall}% below target`}</span>
          <span>Target {required}%</span>
        </div>
      </div>
    </div>
  );
}
