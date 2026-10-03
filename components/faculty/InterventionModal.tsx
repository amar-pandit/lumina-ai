"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface Student {
  id: number;
  name: string;
  issue: string;
}

interface InterventionModalProps {
  open: boolean;
  student: Student | null;
  onClose: () => void;
  onCreate: () => void;
}

export function InterventionModal({ open, student, onClose, onCreate }: InterventionModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Intervention</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Create Academic Intervention</h3>
          </div>
          <button
            type="button"
            aria-label="Close intervention modal"
            onClick={onClose}
            className="rounded-full border border-zinc-700 bg-zinc-900 p-2 text-zinc-200 transition hover:border-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-zinc-500">Student</p>
            <p className="mt-1 text-lg font-medium text-white">{student.name}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-zinc-500">Issue</p>
            <p className="mt-1 text-lg font-medium text-white">{student.issue}</p>
          </div>

          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <p className="text-zinc-300">Recommended action</p>
            <p className="mt-1 text-lg font-medium text-white">Schedule remedial session</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onCreate();
              onClose();
            }}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 hover:brightness-110"
          >
            Create Intervention
          </button>
        </div>
      </div>
    </div>
  );
}
