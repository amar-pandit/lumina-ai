export interface AttendanceInput {
  totalClasses: number;
  attendedClasses: number;
  futureClasses?: number;
  futureAbsences?: number;
  requiredAttendance?: number;
}

export interface AttendanceResult {
  currentAttendance: number;
  projectedAttendance: number;
  safeAbsences: number;
  classesRequiredToRecover: number | null;
}

export function calculateAttendance({
  totalClasses,
  attendedClasses,
  futureClasses = 0,
  futureAbsences = 0,
  requiredAttendance = 75,
}: AttendanceInput): AttendanceResult {
  const classCount = Math.max(1, Math.floor(Number.isFinite(totalClasses) ? totalClasses : 1));
  const attended = Math.min(classCount, Math.max(0, Math.floor(Number.isFinite(attendedClasses) ? attendedClasses : 0)));
  const upcoming = Math.max(0, Math.floor(Number.isFinite(futureClasses) ? futureClasses : 0));
  const absences = Math.min(upcoming, Math.max(0, Math.floor(Number.isFinite(futureAbsences) ? futureAbsences : 0)));
  const minimum = Math.min(100, Math.max(0, Number.isFinite(requiredAttendance) ? requiredAttendance : 75));
  const currentAttendance = (attended / classCount) * 100;
  const projectedAttendance = ((attended + upcoming - absences) / (classCount + upcoming)) * 100;
  const classesRequiredToRecover = currentAttendance >= minimum
    ? 0
    : minimum === 100
      ? null
      : Math.ceil(Math.max(0, (minimum * classCount - attended * 100) / (100 - minimum)));
  const safeAbsences = currentAttendance < minimum
    ? 0
    : Math.max(0, Math.floor(attended / (minimum / 100 || 1) - classCount));

  return {
    currentAttendance: Number(currentAttendance.toFixed(1)),
    projectedAttendance: Number(projectedAttendance.toFixed(1)),
    safeAbsences,
    classesRequiredToRecover,
  };
}