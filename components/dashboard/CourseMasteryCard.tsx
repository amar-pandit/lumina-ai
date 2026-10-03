import { motion } from "framer-motion";

interface Course {
  name: string;
  score: number;
  accent: string;
}

interface CourseMasteryCardProps {
  courses: Course[];
}

export function CourseMasteryCard({ courses }: CourseMasteryCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
      <p className="mb-4 text-lg font-semibold text-white">Course Mastery</p>
      <div className="space-y-4">
        {courses.map((course, index) => (
          <motion.div
            key={course.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
              <span>{course.name}</span>
              <span>{course.score}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${course.accent}`}
                style={{ width: `${course.score}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
