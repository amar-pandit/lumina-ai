export interface StudentSubjectMark {
  name: string;
  score: number;
  accent: string;
}

export interface DemoStudent {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  requiredAttendance: number;
  attendance: number;
  totalClasses: number;
  attendedClasses: number;
  assessmentAverage: number;
  assignmentPerformance: number;
  labCompletion: number;
  academicVelocity: number;
  subjectWiseMarks: StudentSubjectMark[];
}

export const DEMO_STUDENT: DemoStudent = {
  id: "STU-2024-042",
  name: "Amar Kumar",
  rollNumber: "24CS042",
  department: "Computer Science",
  semester: 4,
  requiredAttendance: 75,
  attendance: 72,
  totalClasses: 50,
  attendedClasses: 36,
  assessmentAverage: 54.5,
  assignmentPerformance: 54,
  labCompletion: 92,
  academicVelocity: -1.64,
  subjectWiseMarks: [
    { name: "Data Structures", score: 54.5, accent: "from-violet-500 to-indigo-500" },
    { name: "DBMS", score: 61, accent: "from-cyan-500 to-sky-500" },
    { name: "Operating Systems", score: 74, accent: "from-emerald-500 to-teal-500" },
    { name: "Computer Networks", score: 79, accent: "from-amber-500 to-orange-500" },
    { name: "Java Programming", score: 68, accent: "from-rose-500 to-orange-400" },
    { name: "Mathematics", score: 71, accent: "from-teal-400 to-cyan-500" },
  ],
};
