export type RecoveryPriority = "High" | "Medium" | "Low";

export interface RecoveryTaskInput {
  id: number;
  priority: RecoveryPriority;
}

export interface RecoveryResult {
  completionPercentage: number;
  projectedRisk: number;
  recoveryScore: number;
}

const riskReduction: Record<RecoveryPriority, number> = {
  High: 4,
  Medium: 2.5,
  Low: 1,
};

export function calculateRecovery(
  tasks: readonly RecoveryTaskInput[],
  completedTaskIds: ReadonlySet<number>,
  currentRisk: number,
  targetRisk = 45,
): RecoveryResult {
  const completedTasks = tasks.filter((task) => completedTaskIds.has(task.id));
  const completionPercentage = tasks.length === 0 ? 0 : Math.round((completedTasks.length / tasks.length) * 100);
  const reduction = completedTasks.reduce((total, task) => total + riskReduction[task.priority], 0);
  const projectedRisk = Number(Math.max(0, currentRisk - reduction).toFixed(1));
  const riskProgress = currentRisk <= targetRisk
    ? 100
    : ((currentRisk - projectedRisk) / (currentRisk - targetRisk)) * 100;
  const recoveryScore = Math.min(100, Math.round(completionPercentage * 0.7 + riskProgress * 0.3));

  return { completionPercentage, projectedRisk, recoveryScore };
}