"use client";

import { Topbar } from "@/components/layout/Topbar";
import { RecoveryProgress } from "@/components/recovery/RecoveryProgress";
import { RecoveryTask } from "@/components/recovery/RecoveryTask";
import { calculateRecovery } from "@/lib/recovery-engine";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getRecoveryTasks, getStudentRisk } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

export default function StudentRecoveryPage() {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const recoveryTasks = getRecoveryTasks(demoState);
  const completed = new Set(demoState.completedRecoveryTaskIds);
  const riskSnapshot = getStudentRisk(demoState);
  const recovery = calculateRecovery(recoveryTasks, completed, riskSnapshot.score);

  const handleToggle = (taskId: number, checked: boolean) => {
    setDemoState((previous) => ({
      ...previous,
      completedRecoveryTaskIds: checked
        ? [...new Set([...previous.completedRecoveryTaskIds, taskId])]
        : previous.completedRecoveryTaskIds.filter((id) => id !== taskId),
    }));
  };

  return (
    <div>
      <Topbar title="Your 7-Day Recovery Plan" subtitle={`Current risk: ${riskSnapshot.score.toFixed(1)} → Target < 45`} />

      <main className="space-y-6 p-4 sm:p-6">
        <RecoveryProgress progress={recovery.completionPercentage} currentRisk={riskSnapshot.score} projectedRisk={recovery.projectedRisk} />
        <p className="-mt-3 px-1 text-xs text-zinc-500">Recovery score: <span className="font-semibold text-emerald-200">{recovery.recoveryScore}</span> / 100</p>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Recovery timeline</h3>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
              {completed.size}/{recoveryTasks.length} complete
            </span>
          </div>

          <div className="space-y-4">
            {recoveryTasks.map((task) => (
              <RecoveryTask
                key={task.id}
                title={task.title}
                day={task.day}
                duration={task.duration}
                priority={task.priority}
                completed={completed.has(task.id)}
                onToggle={(checked) => handleToggle(task.id, checked)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
