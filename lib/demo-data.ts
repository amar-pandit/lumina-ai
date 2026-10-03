import { calculateRisk, type RiskResult } from "@/lib/risk-engine";
import { calculateAttendance } from "@/lib/attendance-engine";
import { DEMO_STUDENT } from "@/lib/student-demo-data";

export interface CourseMastery {
  name: string;
  score: number;
  accent: string;
}

export interface RecoveryTask {
  id: number;
  title: string;
  duration: string;
  priority: "High" | "Medium" | "Low";
  day: string;
}

export interface FacultyStudent {
  id: number;
  name: string;
  rollNo: string;
  risk: number;
  attendance: number;
  velocity: number;
  issue: string;
  status: "Critical" | "Moderate" | "Safe";
  department: string;
  year: number;
  course: string;
  mentor: string;
  assessmentAverage: number;
  assignmentCompletion: number;
  labCompletion: number;
  subjectMarks: Record<string, number>;
  riskDrivers: string[];
  criticalSubjects: string[];
  continuousAssessmentFailures: number;
  courseRisk: RiskResult;
}

export const studentProfile = {
  name: DEMO_STUDENT.name,
  branch: "CSE",
  semester: DEMO_STUDENT.semester,
  requiredAttendance: DEMO_STUDENT.requiredAttendance,
};

export const courses: CourseMastery[] = DEMO_STUDENT.subjectWiseMarks;

const attendanceSummary = calculateAttendance({
  totalClasses: DEMO_STUDENT.totalClasses,
  attendedClasses: DEMO_STUDENT.attendedClasses,
  requiredAttendance: studentProfile.requiredAttendance,
});

export const attendanceData = {
  totalClasses: DEMO_STUDENT.totalClasses,
  attendedClasses: DEMO_STUDENT.attendedClasses,
  currentAttendance: attendanceSummary.currentAttendance,
  requiredAttendance: studentProfile.requiredAttendance,
};

export const velocitySeries = [
  ...[4, 3, 2, 1, 0].map((weeksAgo, index) => ({
    week: `Week ${index + 1}`,
    value: Math.max(0, Math.min(100, Number((DEMO_STUDENT.assessmentAverage - DEMO_STUDENT.academicVelocity * weeksAgo).toFixed(1)))),
  })),
];

export const recoveryTasks: RecoveryTask[] = [
  { id: 1, title: "Attend classes", duration: "45 min", priority: "High", day: "Day 1" },
  { id: 2, title: "Complete DBMS assignment", duration: "60 min", priority: "High", day: "Day 2" },
  { id: 3, title: "Practice Graph Algorithms", duration: "35 min", priority: "High", day: "Day 3" },
  { id: 4, title: "Attend all classes", duration: "50 min", priority: "High", day: "Day 4" },
  { id: 5, title: "Take DSA practice test", duration: "30 min", priority: "Medium", day: "Day 5" },
  { id: 6, title: "Review weak topics", duration: "40 min", priority: "Medium", day: "Day 6" },
  { id: 7, title: "Academic progress check", duration: "25 min", priority: "Low", day: "Day 7" },
];

const rosterNames = [
  DEMO_STUDENT.name, "Rahul Sharma", "Priya Singh", "Aarav Mehta", "Ananya Das", "Vihaan Patel",
  "Isha Nair", "Arjun Rao", "Saanvi Shah", "Kabir Joshi", "Mira Kapoor", "Aditya Sen",
  "Tara Menon", "Rohan Gupta", "Diya Iyer", "Neil Verma", "Aanya Bose", "Dev Malhotra",
  "Myra Reddy", "Ishaan Jain", "Sara Thomas", "Kian Bhat", "Anika Roy", "Reyansh Kulkarni",
  "Nisha Pillai", "Yash Sethi", "Riya Ghosh", "Aarush Khanna", "Veda Krishnan", "Ayaan Dutta",
  "Meera Gill", "Zoya Mirza", "Om Prakash", "Pihu Saxena", "Arnav Chawla", "Navya Suri",
  "Aditi Rao", "Harsh Vyas", "Ira Bansal", "Kunal Shetty", "Rhea Mukherjee", "Dhruv Arora",
  "Tia Fernandes", "Samar Khan", "Avni Desai", "Manav Puri", "Kiara Paul", "Ritvik Bose",
  "Naina Lal", "Atharv Naidu", "Sia Chopra", "Parth Mishra", "Mahi Rawat", "Krish Anand",
  "Jiya Sood", "Rudra Yadav", "Esha Mathew", "Nikhil Batra", "Tanishka Dey", "Veer Bedi",
];

const departments = [DEMO_STUDENT.department, "Information Technology", "Electronics", "Mechanical"];
const mentors = ["Dr. Meera Shah", "Prof. Arjun Rao", "Dr. Kavita Menon", "Prof. N. Iyer", "Dr. S. Kapoor"];

export const facultyStudents: FacultyStudent[] = rosterNames.map((name, index) => {
  const criticalDemoCase = index >= 3 && index % 12 === 3;
  const attendance = [DEMO_STUDENT.attendance, 69, 76][index] ?? (criticalDemoCase ? 48 : 54 + ((index * 17) % 45));
  const assessmentAverage = [DEMO_STUDENT.assessmentAverage, 39, 58][index] ?? (criticalDemoCase ? 18 : 28 + ((index * 19) % 68));
  const assignmentCompletion = [DEMO_STUDENT.assignmentPerformance, 48, 67][index] ?? (criticalDemoCase ? 24 : 35 + ((index * 23) % 65));
  const labCompletion = [DEMO_STUDENT.labCompletion, 68, 81][index] ?? (criticalDemoCase ? 35 : 40 + ((index * 29) % 61));
  const academicVelocity = [DEMO_STUDENT.academicVelocity, -2.1, -0.8][index] ?? (criticalDemoCase ? -3 : index % 3 === 0 ? -0.5 - ((index * 7) % 28) / 10 : 0.1 + ((index * 5) % 16) / 10);
  const riskResult = calculateRisk({ attendance, assessmentAverage, academicVelocity, assignmentPerformance: assignmentCompletion, labCompletion });
  const course = courses[index % courses.length].name;
  const strongestDriver = [...riskResult.factors].sort((left, right) => right.contribution - left.contribution)[0];
  const criticalSubjects = riskResult.category === "CRITICAL"
    ? courses.slice(0, 3 + (index % 3)).map((subject) => subject.name)
    : courses.slice(0, index % 3).map((subject) => subject.name);
  const continuousAssessmentFailures = assessmentAverage < 45 ? 2 : assessmentAverage < 55 ? 1 : 0;

  return {
    id: index + 1,
    name,
    rollNo: [DEMO_STUDENT.rollNumber, "24CS018", "24CS031"][index] ?? `24CS${String(100 + index).padStart(3, "0")}`,
    risk: riskResult.score,
    attendance,
    velocity: academicVelocity,
    issue: strongestDriver.name,
    status: riskResult.category === "CRITICAL" ? "Critical" : riskResult.category === "MODERATE" ? "Moderate" : "Safe",
    department: departments[index % departments.length],
    year: 1 + (index % 4),
    course,
    mentor: mentors[index % mentors.length],
    assessmentAverage,
    assignmentCompletion,
    labCompletion,
    subjectMarks: Object.fromEntries(courses.map((subject, subjectIndex) => {
      const score = index === 0
        ? DEMO_STUDENT.subjectWiseMarks[subjectIndex]?.score ?? assessmentAverage
        : Math.max(0, Math.min(100, Number((assessmentAverage + (((index * 7 + subjectIndex * 11) % 19) - 9) * 1.1).toFixed(1))));
      return [subject.name, score];
    })),
    riskDrivers: riskResult.factors.filter((factor) => factor.contribution >= 10).map((factor) => factor.name),
    criticalSubjects,
    continuousAssessmentFailures,
    courseRisk: riskResult,
  };
});

export const riskHeatmap = [
  { subject: "Data Structures", values: [82, 71, 68, 76, 60] },
  { subject: "DBMS", values: [58, 63, 74, 69, 71] },
  { subject: "OS", values: [67, 72, 81, 77, 75] },
  { subject: "Computer Networks", values: [79, 74, 69, 72, 83] },
];
