"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowRight, CalendarCheck2, ClipboardCheck } from "lucide-react";
import { DemoControls } from "@/components/layout/DemoControls";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getSimulatorAttendance, getStudentRisk } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

export default function HomePage() {
  const [demoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const riskSnapshot = getStudentRisk(demoState);
  const attendance = getSimulatorAttendance(demoState);
  const studentGrades = demoState.gradebook[1];
  const riskTone = riskSnapshot.category === "CRITICAL" ? "text-rose-200 border-rose-300/20 bg-rose-300/[0.08]" : riskSnapshot.category === "MODERATE" ? "text-amber-100 border-amber-200/20 bg-amber-200/[0.08]" : "text-emerald-100 border-emerald-200/20 bg-emerald-200/[0.08]";
  const dashboardLinks = [
    { title: "Academic risk", value: riskSnapshot.score.toFixed(1), detail: riskSnapshot.category, href: "/student/risk", icon: Activity, tone: "text-rose-300 bg-rose-400/10 border-rose-300/15" },
    { title: "Attendance", value: `${attendance.currentAttendance}%`, detail: `${demoState.settings.attendanceMinimum}% required`, href: "/student/attendance", icon: CalendarCheck2, tone: "text-amber-200 bg-amber-300/10 border-amber-200/15" },
    { title: "Recovery plan", value: `${demoState.recoveryTasks.length} steps`, detail: "7-day plan", href: "/student/recovery", icon: ClipboardCheck, tone: "text-emerald-200 bg-emerald-300/10 border-emerald-200/15" },
  ];
  const courseHealth = [
    { label: "Attendance", value: attendance.currentAttendance, tone: "from-amber-400 to-orange-400" },
    { label: "Data Structures", value: Math.round(studentGrades.cia * 0.3 + studentGrades.midterm * 0.3 + studentGrades.lab * 0.25 + studentGrades.assignment * 0.15), tone: "from-rose-400 to-orange-300" },
    { label: "Lab completion", value: studentGrades.lab, tone: "from-emerald-300 to-cyan-300" },
  ];

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b1314]/80 px-4 py-3 backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-300/10 text-sm font-bold text-emerald-100">
              L
            </div>
            <span className="text-lg font-semibold text-white">CampusX</span>
          </div>
          <nav className="hidden items-center gap-2 text-xs text-zinc-300 sm:flex sm:gap-5 sm:text-sm">
            <Link href="/student/dashboard" className="rounded-lg px-2 py-2 transition hover:text-emerald-100">Student workspace</Link>
            <Link href="/faculty/dashboard" className="rounded-lg px-2 py-2 transition hover:text-emerald-100">Faculty workspace</Link>
          </nav>
          <DemoControls />
        </header>

        <section className="grid items-center gap-8 pb-8 pt-2 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="mb-5 inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-medium uppercase text-emerald-100">
              AI Academic Early Warning System
            </div>
            <h1 className="max-w-xl text-5xl font-semibold text-white sm:text-6xl">
              CampusX
            </h1>
            <h2 className="mt-3 text-2xl font-medium text-emerald-200 sm:text-3xl">
              Predict. Explain. Recover.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
              An AI-powered academic early warning system that helps students understand academic risk before it becomes a problem.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/student/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100/20 bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#10201a] shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-200"
              >
                Open Student Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/faculty/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.035] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              >
                View Faculty Dashboard
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-[#111a1b]/90 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-4"
          >
            <div className="rounded-xl border border-white/10 bg-[#0b1213] p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Student health</p>
                  <p className="text-xl font-semibold text-white">Academic risk</p>
                </div>
                <div className={`rounded-full border px-2.5 py-1 text-xs font-medium uppercase ${riskTone}`}>
                  {riskSnapshot.category}
                </div>
              </div>

              <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div>
                  <p className="text-4xl font-semibold text-white">{riskSnapshot.score.toFixed(1)}</p>
                  <p className="mt-1 text-sm text-zinc-400">Risk score</p>
                </div>
                <div
                  className="relative flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(${riskSnapshot.category === "CRITICAL" ? "#fb7185" : riskSnapshot.category === "MODERATE" ? "#fbbf24" : "#6ee7b7"} ${riskSnapshot.score * 3.6}deg, rgba(255,255,255,0.06) 0deg)` }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 text-lg font-semibold text-white">{Math.round(riskSnapshot.score)}</div>
                </div>
              </div>

              <div className="space-y-3">
                {courseHealth.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-200">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section aria-label="Dashboard shortcuts" className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
          {dashboardLinks.map(({ title, value, detail, href, icon: Icon, tone }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Link href={href} className="group flex min-h-24 items-center gap-3 rounded-xl border border-white/10 bg-[#101819]/80 p-4 transition hover:border-white/20 hover:bg-[#14201f]">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-300">{title}</span>
                  <span className="mt-1 block truncate text-lg font-semibold text-white">{value} <span className="text-xs font-medium text-zinc-400">{detail}</span></span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" />
              </Link>
            </motion.div>
          ))}
        </section>
      </div>
    </main>
  );
}
