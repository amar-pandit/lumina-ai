"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AttendanceCard } from "@/components/dashboard/AttendanceCard";
import { CourseMasteryCard } from "@/components/dashboard/CourseMasteryCard";
import { RiskCard } from "@/components/dashboard/RiskCard";
import { VelocityCard } from "@/components/dashboard/VelocityCard";
import { RiskChart } from "@/components/risk/RiskChart";
import { velocitySeries } from "@/lib/demo-data";
import { DEMO_STUDENT } from "@/lib/student-demo-data";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getStudentProfile, getStudentRisk } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";
import { useDemoSession } from "@/components/auth/useDemoSession";

export default function StudentDashboardPage() {
  const [demoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const { session } = useDemoSession();
  const student = getStudentProfile(demoState, session?.user.studentId);
  const riskSnapshot = getStudentRisk(demoState, student.id);
  const currentCourses = student.subjectWiseMarks;
  const attendanceTrend = Number((student.attendance - DEMO_STUDENT.attendance).toFixed(1));

  return (
    <div>
      <Topbar title={`Good evening, ${session?.user.name ?? student.name.split(" ")[0]}`} subtitle="Your academic health at a glance." />

      <main className="space-y-6 p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[30px] border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Academic overview</p>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{riskSnapshot.category === "SAFE" ? "Your learning signal is on track." : riskSnapshot.category === "MODERATE" ? "Your learning signal needs attention." : "Your learning signal is trending below target."}</h2>
            </div>
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
              Target: stay below 45 risk score by next review · current {riskSnapshot.score.toFixed(1)}
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <RiskCard score={riskSnapshot.score} category={riskSnapshot.category} />
          </div>
          <div className="lg:col-span-1">
            <AttendanceCard
              attendance={student.attendance}
              required={demoState.settings.attendanceMinimum}
              trend={attendanceTrend}
            />
          </div>
          <div className="lg:col-span-1">
            <VelocityCard value={riskSnapshot.velocity} label={riskSnapshot.velocity < 0 ? "Declining" : "Improving"} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <CourseMasteryCard courses={currentCourses} />

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-5">
              <h3 className="mb-4 text-xl font-semibold text-white">Why is your risk increasing?</h3>
              <div className="space-y-3">
                {riskSnapshot.factors.map((factor) => (
                  <div key={factor.name} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{factor.name}</p>
                        <p className="mt-1 text-sm text-zinc-400">{factor.score}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${
                        factor.impact === "High"
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : factor.impact === "Medium"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      }`}>
                        {factor.contribution.toFixed(1)} risk points · {factor.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-5">
              <h3 className="mb-4 text-xl font-semibold text-white">Academic Velocity</h3>
              <RiskChart data={velocitySeries} />
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-5">
              <h3 className="mb-4 text-xl font-semibold text-white">Recommended Next Steps</h3>
              <div className="space-y-3">
                {riskSnapshot.recommendations.map((task, index) => (
                  <motion.div
                    key={task}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 transition hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-zinc-200">{task}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500" />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
