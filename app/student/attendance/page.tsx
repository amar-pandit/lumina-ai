"use client";

import { AttendanceSimulator } from "@/components/attendance/AttendanceSimulator";
import { Topbar } from "@/components/layout/Topbar";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getSimulatorAttendance } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

export default function StudentAttendancePage() {
  const [demoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const attendance = getSimulatorAttendance(demoState);
  const requiredAttendance = demoState.settings.attendanceMinimum;

  return (
    <div>
      <Topbar title="Attendance Simulator" subtitle="Understand exactly how your attendance changes before you make the next decision." />
      <main className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-sm text-zinc-400">Current attendance</p>
            <p className="mt-2 text-3xl font-semibold text-white">{attendance.currentAttendance}%</p>
          </div>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-sm text-zinc-400">Required minimum</p>
            <p className="mt-2 text-3xl font-semibold text-white">{requiredAttendance}%</p>
          </div>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-sm text-zinc-400">Classes to recover</p>
            <p className="mt-2 text-3xl font-semibold text-white">{attendance.classesRequiredToRecover ?? "N/A"}</p>
          </div>
        </div>

        <AttendanceSimulator />
      </main>
    </div>
  );
}
