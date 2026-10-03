"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { FacultyStudent } from "@/lib/demo-data";

interface StudentRiskTableProps {
  students: FacultyStudent[];
  onIntervene: (student: FacultyStudent) => void;
}

const filterOptions = ["All", "Critical", "Moderate", "Safe"] as const;

export function StudentRiskTable({ students, onIntervene }: StudentRiskTableProps) {
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("All");

  const visibleStudents = useMemo(() => {
    if (filter === "All") return students;
    return students.filter((student) => student.status === filter);
  }, [filter, students]);

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Students Requiring Attention</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === option
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-3 pr-4 font-medium">Student</th>
              <th className="py-3 pr-4 font-medium">Roll No</th>
              <th className="py-3 pr-4 font-medium">Risk</th>
              <th className="py-3 pr-4 font-medium">Attendance</th>
              <th className="py-3 pr-4 font-medium">Velocity</th>
              <th className="py-3 pr-4 font-medium">Primary Issue</th>
              <th className="py-3 pr-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student) => (
              <tr key={student.id} className="border-b border-zinc-800/80 text-zinc-200 transition hover:bg-zinc-950/40">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20">
                      {student.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    {student.name}
                  </div>
                </td>
                <td className="py-3 pr-4 text-zinc-300">{student.rollNo}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{student.risk.toFixed(1)}</span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      student.status === "Critical"
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : student.status === "Moderate"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}>
                      {student.status}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">{student.attendance}%</td>
                <td className="py-3 pr-4">{student.velocity.toFixed(2)}</td>
                <td className="py-3 pr-4 text-zinc-300">{student.issue}</td>
                <td className="py-3 pr-4">
                  <button
                    type="button"
                    onClick={() => onIntervene(student)}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:border-indigo-400 hover:bg-indigo-500/20"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Intervene
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
