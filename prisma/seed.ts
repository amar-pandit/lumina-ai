import { PrismaClient, RiskCategory, AttendanceStatus, InterventionStatus, type Prisma } from "@prisma/client";
import { DEMO_ACCOUNT_CREDENTIALS } from "../lib/auth/demo-account-credentials";
import { courses, facultyStudents } from "../lib/demo-data";
import { INITIAL_DEMO_STATE } from "../lib/demo-model";
import { HOD_DEPARTMENT } from "../lib/hod-data";
import { DEFAULT_LUMINA_CONFIG } from "../lib/lumina-config";
import { DEMO_STUDENT } from "../lib/student-demo-data";

const prisma = new PrismaClient();
const SEED_TERM = "Fall 2026";
const BASELINE_CLASS_COUNT = 50;

function codeFor(value: string): string {
  return value.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 16);
}

function attendanceStatus(status: string): AttendanceStatus {
  switch (status) {
    case "Present": return AttendanceStatus.PRESENT;
    case "Absent": return AttendanceStatus.ABSENT;
    case "On Duty": return AttendanceStatus.ON_DUTY;
    case "Medical Leave": return AttendanceStatus.MEDICAL_LEAVE;
    default: return AttendanceStatus.NOT_MARKED;
  }
}

function interventionStatus(status: string): InterventionStatus {
  switch (status) {
    case "Completed": return InterventionStatus.COMPLETED;
    case "Cancelled": return InterventionStatus.CANCELLED;
    case "No-show": return InterventionStatus.NO_SHOW;
    default: return InterventionStatus.SCHEDULED;
  }
}

async function main() {
  const seededAt = new Date("2026-10-04T00:00:00.000Z");
  const departments = [...new Set(facultyStudents.map((student) => student.department))];
  const courseNames = [...new Set(courses.map((course) => course.name))];
  const mentorNames = [...new Set(facultyStudents.map((student) => student.mentor))];
  const facultyAccount = DEMO_ACCOUNT_CREDENTIALS.find((account) => account.role === "FACULTY");
  const studentAccount = DEMO_ACCOUNT_CREDENTIALS.find((account) => account.role === "STUDENT");
  const hodAccount = DEMO_ACCOUNT_CREDENTIALS.find((account) => account.role === "HOD");

  await prisma.$transaction(async (tx) => {
    const roleIds = new Map<string, string>();
    for (const roleName of ["STUDENT", "FACULTY", "MENTOR", "HOD", "ADMIN"] as const) {
      const role = await tx.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      roleIds.set(roleName, role.id);
    }
    await tx.riskConfiguration.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        attendanceMinimum: DEFAULT_LUMINA_CONFIG.risk.attendanceMinimum,
        moderateThreshold: DEFAULT_LUMINA_CONFIG.risk.moderate,
        criticalThreshold: DEFAULT_LUMINA_CONFIG.risk.critical,
        attendanceWeight: DEFAULT_LUMINA_CONFIG.riskWeights.attendance,
        assessmentWeight: DEFAULT_LUMINA_CONFIG.riskWeights.assessment,
        assignmentWeight: DEFAULT_LUMINA_CONFIG.riskWeights.assignment,
        labWeight: DEFAULT_LUMINA_CONFIG.riskWeights.lab,
        velocityWeight: DEFAULT_LUMINA_CONFIG.riskWeights.velocity,
      },
    });

    for (const account of DEMO_ACCOUNT_CREDENTIALS) {
      await tx.user.upsert({
        where: { id: account.id },
        update: { email: account.email, name: account.name, isDemo: true },
        create: { id: account.id, email: account.email, name: account.name, isDemo: true },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: account.id, roleId: roleIds.get(account.role)! } },
        update: {},
        create: { userId: account.id, roleId: roleIds.get(account.role)! },
      });
    }

    const departmentIds = new Map<string, string>();
    for (const departmentName of departments) {
      const code = codeFor(departmentName);
      const department = await tx.department.upsert({
        where: { code },
        update: {
          name: departmentName,
          ...(departmentName === HOD_DEPARTMENT && hodAccount ? { headUserId: hodAccount.id } : {}),
          isDemo: true,
        },
        create: {
          code,
          name: departmentName,
          ...(departmentName === HOD_DEPARTMENT && hodAccount ? { headUserId: hodAccount.id } : {}),
          isDemo: true,
        },
      });
      departmentIds.set(departmentName, department.id);
    }

    const courseIds = new Map<string, string>();
    for (const courseName of courseNames) {
      const code = codeFor(courseName);
      const course = await tx.course.upsert({
        where: { code },
        update: { name: courseName, isDemo: true },
        create: { code, name: courseName, isDemo: true },
      });
      courseIds.set(courseName, course.id);
    }

    if (facultyAccount) {
      const faculty = await tx.faculty.upsert({
        where: { userId: facultyAccount.id },
        update: { displayName: facultyAccount.name, isDemo: true },
        create: { userId: facultyAccount.id, displayName: facultyAccount.name, isDemo: true },
      });
      for (const courseId of courseIds.values()) {
        await tx.facultyCourse.upsert({
          where: { facultyId_courseId_term: { facultyId: faculty.id, courseId, term: SEED_TERM } },
          update: {},
          create: { facultyId: faculty.id, courseId, term: SEED_TERM },
        });
      }
    }

    const mentorIds = new Map<string, string>();
    for (const mentorName of mentorNames) {
      const account = DEMO_ACCOUNT_CREDENTIALS.find((candidate) =>
        candidate.role === "MENTOR" && candidate.name === mentorName);
      const mentor = account
        ? await tx.mentor.upsert({
          where: { userId: account.id },
          update: { displayName: mentorName, isDemo: true },
          create: { userId: account.id, displayName: mentorName, isDemo: true },
        })
        : await tx.mentor.upsert({
          where: { id: `demo-mentor-${codeFor(mentorName).toLowerCase()}` },
          update: { displayName: mentorName, isDemo: true },
          create: { id: `demo-mentor-${codeFor(mentorName).toLowerCase()}`, displayName: mentorName, isDemo: true },
        });
      mentorIds.set(mentorName, mentor.id);
    }

    const classIds = new Map<string, string>();
    for (const student of facultyStudents) {
      const departmentId = departmentIds.get(student.department);
      if (!departmentId) throw new Error(`Missing seeded department for ${student.department}.`);
      const className = `Year ${student.year}`;
      const key = `${student.department}:${className}`;
      if (!classIds.has(key)) {
        const classGroup = await tx.classGroup.upsert({
          where: { departmentId_name: { departmentId, name: className } },
          update: { year: student.year },
          create: { departmentId, name: className, year: student.year },
        });
        classIds.set(key, classGroup.id);
      }
    }

    const studentIds = new Map<number, string>();
    for (const student of facultyStudents) {
      const departmentId = departmentIds.get(student.department)!;
      const classGroupId = classIds.get(`${student.department}:Year ${student.year}`)!;
      const studentRecord = await tx.student.upsert({
        where: { rollNumber: student.rollNo },
        update: {
          externalId: `demo-faculty-student-${student.id}`,
          name: student.name,
          year: student.year,
          departmentId,
          classGroupId,
          academicVelocity: student.velocity,
          requiredAttendance: DEMO_STUDENT.requiredAttendance,
          ...(student.id === 1 && studentAccount ? { authUserId: studentAccount.id } : {}),
          isDemo: true,
        },
        create: {
          externalId: `demo-faculty-student-${student.id}`,
          name: student.name,
          rollNumber: student.rollNo,
          year: student.year,
          departmentId,
          classGroupId,
          academicVelocity: student.velocity,
          requiredAttendance: DEMO_STUDENT.requiredAttendance,
          ...(student.id === 1 && studentAccount ? { authUserId: studentAccount.id } : {}),
          isDemo: true,
        },
      });
      studentIds.set(student.id, studentRecord.id);

      const attendedClasses = Math.round((student.attendance / 100) * BASELINE_CLASS_COUNT);
      await tx.attendanceBaseline.upsert({
        where: { studentId: studentRecord.id },
        update: {
          totalClasses: BASELINE_CLASS_COUNT,
          attendedClasses,
          importedAt: seededAt,
          source: "CONTROLLED_DEMO_ROSTER_IMPORT",
          isDemo: true,
        },
        create: {
          studentId: studentRecord.id,
          totalClasses: BASELINE_CLASS_COUNT,
          attendedClasses,
          importedAt: seededAt,
          source: "CONTROLLED_DEMO_ROSTER_IMPORT",
          isDemo: true,
        },
      });

      const primaryCourseId = courseIds.get(student.course);
      if (primaryCourseId) {
        const attendanceSession = await tx.attendanceSession.upsert({
          where: {
            courseId_classGroupId_sessionDate: {
              courseId: primaryCourseId,
              classGroupId,
              sessionDate: seededAt,
            },
          },
          update: { label: "Controlled demo roster import", markedByUserId: facultyAccount?.id },
          create: {
            courseId: primaryCourseId,
            classGroupId,
            sessionDate: seededAt,
            label: "Controlled demo roster import",
            markedByUserId: facultyAccount?.id,
          },
        });
        await tx.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: attendanceSession.id, studentId: studentRecord.id } },
          update: {
            status: attendanceStatus(INITIAL_DEMO_STATE.attendanceByStudent[student.id] ?? "Not Marked"),
            recordedAt: seededAt,
            isDemo: true,
          },
          create: {
            sessionId: attendanceSession.id,
            studentId: studentRecord.id,
            status: attendanceStatus(INITIAL_DEMO_STATE.attendanceByStudent[student.id] ?? "Not Marked"),
            recordedAt: seededAt,
            isDemo: true,
          },
        });
      }

      for (const courseName of courseNames) {
        const courseId = courseIds.get(courseName);
        if (!courseId) continue;
        await tx.enrollment.upsert({
          where: { studentId_courseId_term: { studentId: studentRecord.id, courseId, term: SEED_TERM } },
          update: { classGroupId, isActive: true, isDemo: true },
          create: {
            studentId: studentRecord.id,
            courseId,
            classGroupId,
            term: SEED_TERM,
            isDemo: true,
          },
        });
        const score = student.subjectMarks[courseName] ?? student.assessmentAverage;
        await tx.grade.upsert({
          where: { studentId_courseId_term: { studentId: studentRecord.id, courseId, term: SEED_TERM } },
          update: {
            cia: score,
            midterm: score,
            lab: student.labCompletion,
            assignment: student.assignmentCompletion,
            recordedAt: seededAt,
            isDemo: true,
          },
          create: {
            studentId: studentRecord.id,
            courseId,
            term: SEED_TERM,
            cia: score,
            midterm: score,
            lab: student.labCompletion,
            assignment: student.assignmentCompletion,
            recordedAt: seededAt,
            isDemo: true,
          },
        });
      }

      const mentorId = mentorIds.get(student.mentor);
      if (mentorId) {
        await tx.mentorAssignment.upsert({
          where: {
            mentorId_studentId_startsAt: {
              mentorId,
              studentId: studentRecord.id,
              startsAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          },
          update: { isActive: true, classGroupId },
          create: {
            mentorId,
            studentId: studentRecord.id,
            classGroupId,
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            isActive: true,
          },
        });
      }

      const risk = student.courseRisk;
      const riskFactors: Prisma.InputJsonArray = risk.factors.map((factor) => ({
        name: factor.name,
        score: factor.score,
        impact: factor.impact,
        contribution: factor.contribution,
      }));
      const riskRecommendations: Prisma.InputJsonArray = risk.recommendations;
      await tx.riskSnapshot.upsert({
        where: { studentId_inputHash: { studentId: studentRecord.id, inputHash: `demo-seed-${student.id}` } },
        update: {
          score: risk.score,
          category: RiskCategory[risk.category],
          attendance: student.attendance,
          assessment: student.assessmentAverage,
          velocity: student.velocity,
          assignment: student.assignmentCompletion,
          labCompletion: student.labCompletion,
          factors: riskFactors,
          recommendations: riskRecommendations,
          inputHash: `demo-seed-${student.id}`,
          isDemo: true,
        },
        create: {
          studentId: studentRecord.id,
          calculatedAt: seededAt,
          score: risk.score,
          category: RiskCategory[risk.category],
          attendance: student.attendance,
          assessment: student.assessmentAverage,
          velocity: student.velocity,
          assignment: student.assignmentCompletion,
          labCompletion: student.labCompletion,
          factors: riskFactors,
          recommendations: riskRecommendations,
          engineVersion: "demo-seed-v1",
          inputHash: `demo-seed-${student.id}`,
          isDemo: true,
        },
      });
    }

    for (const item of INITIAL_DEMO_STATE.interventions) {
      const student = facultyStudents.find((candidate) => candidate.name === item.student);
      if (!student) continue;
      const scheduledAt = new Date(`${item.date}T00:00:00.000Z`);
      await tx.intervention.upsert({
        where: { id: `demo-intervention-${item.id}` },
        update: {
          studentId: studentIds.get(student.id)!,
          title: item.type,
          notes: item.notes,
          scheduledAt,
          status: interventionStatus(item.status),
          isDemo: true,
        },
        create: {
          id: `demo-intervention-${item.id}`,
          studentId: studentIds.get(student.id)!,
          title: item.type,
          notes: item.notes,
          scheduledAt,
          status: interventionStatus(item.status),
          isDemo: true,
        },
      });
    }
  }, { timeout: 120000 });

  console.log(`Seeded ${facultyStudents.length} demo students, ${courseNames.length} courses, and ${departments.length} departments.`);
  console.log("Exam records were not seeded because no exam source exists in the current app.");
  console.log("Mentor assignment rows are demo fixtures. Only authenticated user-linked Mentor records grant API visibility.");
  console.log("Parent follow-up rows were not invented; the current app has no persisted source records.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
