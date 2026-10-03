"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface RecoveryTaskProps {
  title: string;
  day: string;
  duration: string;
  priority: "High" | "Medium" | "Low";
  completed?: boolean;
  onToggle?: (checked: boolean) => void;
}

const priorityStyles: Record<RecoveryTaskProps["priority"], string> = {
  High: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  Medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

export function RecoveryTask({ title, day, duration, priority, completed = false, onToggle }: RecoveryTaskProps) {
  const handleToggle = () => {
    onToggle?.(!completed);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
      aria-pressed={completed}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-200">
          {completed ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-zinc-500" />}
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.15em] text-zinc-500">{day}</p>
          <p className="mt-1 font-medium text-white">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${priorityStyles[priority]}`}>
          {priority}
        </span>
        <span className="text-sm text-zinc-400">{duration}</span>
      </div>
    </button>
  );
}
