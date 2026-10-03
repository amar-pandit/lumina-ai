"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AttendanceGauge } from "@/components/attendance/AttendanceGauge";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getSimulatorAttendance } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

export function AttendanceSimulator() {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const { totalClasses, classesAttended, futureClasses, futureAbsences } = demoState.attendanceSimulator;

  const requiredAttendance = demoState.settings.attendanceMinimum;
  const attendanceResult = getSimulatorAttendance(demoState);
  const { currentAttendance, projectedAttendance, safeAbsences: safeMisses, classesRequiredToRecover: classesRequired } = attendanceResult;

  const statusText = currentAttendance < requiredAttendance ? "Below Required Attendance" : "Meeting Requirement";
  const recoveryText =
    currentAttendance < requiredAttendance
      ? classesRequired === null ? "A 100% requirement cannot be reached after a past absence." : `Attend next ${classesRequired} classes consecutively.`
      : "You are on track to maintain attendance compliance.";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              <span className="mb-2 block">Total Classes</span>
              <input
                aria-label="Total classes"
                type="number"
                min={1}
                value={totalClasses}
                onChange={(event) => {
                  const nextTotal = Math.max(1, Number(event.target.value) || 1);
                  setDemoState((previous) => ({
                    ...previous,
                    attendanceSimulator: {
                      ...previous.attendanceSimulator,
                      totalClasses: Math.floor(nextTotal),
                      classesAttended: Math.min(previous.attendanceSimulator.classesAttended, Math.floor(nextTotal)),
                    },
                  }));
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-indigo-500"
              />
            </label>

            <label className="block text-sm text-zinc-300">
              <span className="mb-2 block">Classes Attended</span>
              <input
                aria-label="Classes attended"
                type="number"
                min={0}
                max={totalClasses}
                value={classesAttended}
                onChange={(event) => setDemoState((previous) => ({
                  ...previous,
                  attendanceSimulator: {
                    ...previous.attendanceSimulator,
                    classesAttended: Math.floor(Math.max(0, Math.min(Number(event.target.value) || 0, totalClasses))),
                  },
                }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-indigo-500"
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-sm text-zinc-400">Current Attendance</p>
            <div aria-live="polite" className="mt-2 text-4xl font-semibold text-white">{currentAttendance.toFixed(1)}%</div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label htmlFor="future-classes" className="block text-sm text-zinc-300">
              <span className="mb-2 block">Future classes</span>
              <input
                id="future-classes"
                aria-label="Future classes"
                type="number"
                min={0}
                value={futureClasses}
                onChange={(event) => setDemoState((previous) => {
                  const nextFutureClasses = Math.floor(Math.max(0, Number(event.target.value) || 0));
                  return {
                    ...previous,
                    attendanceSimulator: {
                      ...previous.attendanceSimulator,
                      futureClasses: nextFutureClasses,
                      futureAbsences: Math.min(previous.attendanceSimulator.futureAbsences, nextFutureClasses),
                    },
                  };
                })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-white outline-none transition focus:border-indigo-500"
              />
            </label>
            <label htmlFor="future-absences" className="block text-sm text-zinc-300">
              <span className="mb-2 block">Future absences</span>
              <input
                id="future-absences"
                aria-label="Future absences"
                type="number"
                min={0}
                max={futureClasses}
                value={futureAbsences}
                onChange={(event) => setDemoState((previous) => ({
                  ...previous,
                  attendanceSimulator: {
                    ...previous.attendanceSimulator,
                    futureAbsences: Math.floor(Math.min(
                      previous.attendanceSimulator.futureClasses,
                      Math.max(0, Number(event.target.value) || 0),
                    )),
                  },
                }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-white outline-none transition focus:border-indigo-500"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Projected attendance</p>
              <p aria-live="polite" className="mt-2 text-3xl font-semibold text-white">{projectedAttendance.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Need to reach</p>
              <p className="mt-2 text-3xl font-semibold text-white">{requiredAttendance}%</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <AttendanceGauge value={Number(currentAttendance.toFixed(0))} label="Current" />
          <div className="mt-6 w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-400">Current Status</span>
              {currentAttendance < requiredAttendance ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {statusText}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {statusText}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              <div className="flex items-center justify-between">
                <span>Classes required</span>
                <span className="font-semibold text-white">{classesRequired ?? "Not attainable"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Classes you can safely miss</span>
                <span className="font-semibold text-white">{safeMisses}</span>
              </div>
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Recovery plan</p>
                <p className="mt-2 text-sm text-zinc-200">{recoveryText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
