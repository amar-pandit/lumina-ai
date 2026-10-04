import "server-only";

import { createHash } from "node:crypto";
import { NotificationEventType, RiskCategory, type Prisma } from "@prisma/client";
import type { DemoSession } from "@/lib/auth-types";
import { studentScopeWhere } from "@/lib/academic-authorization";
import { DEFAULT_LUMINA_CONFIG } from "@/lib/lumina-config";
import { calculateRisk } from "@/lib/risk-engine";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient;

function attendanceCountsAsPresent(status: string): boolean {
  return status === "PRESENT"
    || status === "ON_DUTY"
    || status === "MEDICAL_LEAVE"
    || status === "OTHER_APPROVED_LEAVE";
}

export async function calculateAndPersistStudentRisk(db: Db, studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      attendanceBaseline: true,
      attendance: { orderBy: { recordedAt: "asc" }, select: { id: true, status: true, recordedAt: true } },
      grades: { orderBy: { recordedAt: "desc" } },
      riskSnapshots: { take: 1, orderBy: { calculatedAt: "desc" } },
    },
  });
  if (!student) return null;

  const baselineClasses = student.attendanceBaseline?.totalClasses ?? 0;
  const baselineAttended = student.attendanceBaseline?.attendedClasses ?? 0;
  const attendanceRecords = student.attendance.filter((record) => (
    !student.attendanceBaseline || record.recordedAt > student.attendanceBaseline.importedAt
  ));
  const additionalClasses = attendanceRecords.length;
  const additionalAttended = attendanceRecords.filter((record) => attendanceCountsAsPresent(record.status)).length;
  const totalClasses = baselineClasses + additionalClasses;
  if (totalClasses === 0) return null;
  const attendance = totalClasses > 0
    ? (baselineAttended + additionalAttended) / totalClasses * 100
    : 0;

  const latestGradesByCourse = new Map<string, typeof student.grades[number]>();
  for (const grade of student.grades) {
    if (!latestGradesByCourse.has(grade.courseId)) latestGradesByCourse.set(grade.courseId, grade);
  }
  const grades = [...latestGradesByCourse.values()];
  if (grades.length === 0) return null;
  const average = (select: (grade: (typeof grades)[number]) => number) => (
    grades.length ? grades.reduce((sum, grade) => sum + select(grade), 0) / grades.length : 0
  );
  const assessment = average((grade) => grade.cia * 0.3 + grade.midterm * 0.3 + grade.lab * 0.25 + grade.assignment * 0.15);
  const assignment = average((grade) => grade.assignment);
  const labCompletion = average((grade) => grade.lab);
  const configuration = await db.riskConfiguration.findUnique({ where: { id: "default" } });
  const weights = configuration ? {
    attendance: configuration.attendanceWeight,
    assessment: configuration.assessmentWeight,
    assignment: configuration.assignmentWeight,
    lab: configuration.labWeight,
    velocity: configuration.velocityWeight,
  } : DEFAULT_LUMINA_CONFIG.riskWeights;
  const thresholds = configuration ? {
    attendanceMinimum: configuration.attendanceMinimum,
    moderate: configuration.moderateThreshold,
    critical: configuration.criticalThreshold,
  } : DEFAULT_LUMINA_CONFIG.risk;
  const result = calculateRisk({
    attendance,
    assessmentAverage: assessment,
    academicVelocity: student.academicVelocity,
    assignmentPerformance: assignment,
    labCompletion,
  }, weights, thresholds);
  const inputs = {
    baselineClasses,
    baselineAttended,
    attendanceRecords: attendanceRecords.map((record) => [record.id, record.status, record.recordedAt.toISOString()]),
    grades: grades.map((grade) => [grade.id, grade.cia, grade.midterm, grade.lab, grade.assignment]),
    academicVelocity: student.academicVelocity,
    configuration: configuration?.updatedAt.toISOString() ?? "defaults",
  };
  const inputHash = createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
  const previous = student.riskSnapshots[0];
  const category = RiskCategory[result.category];
  const factors: Prisma.InputJsonArray = result.factors.map((factor) => ({
    name: factor.name,
    score: factor.score,
    impact: factor.impact,
    contribution: factor.contribution,
  }));
  const recommendations: Prisma.InputJsonArray = result.recommendations;

  const snapshot = await db.riskSnapshot.upsert({
    where: { studentId_inputHash: { studentId, inputHash } },
    update: {},
    create: {
      studentId,
      calculatedAt: new Date(),
      score: result.score,
      category,
      attendance,
      assessment,
      velocity: student.academicVelocity,
      assignment,
      labCompletion,
      factors,
      recommendations,
      engineVersion: "risk-engine-v1",
      inputHash,
      isDemo: student.isDemo,
    },
  });

  if (category === RiskCategory.CRITICAL && previous?.category !== RiskCategory.CRITICAL) {
    const dedupeKey = `CRITICAL_RISK_CREATED:${student.id}:${inputHash}`;
    await db.notificationEvent.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        type: NotificationEventType.CRITICAL_RISK_CREATED,
        title: "Student entered critical academic risk",
        description: "The deterministic risk engine classified this student as critical.",
        payload: {
          riskSnapshotId: snapshot.id,
          score: result.score,
          factors,
          recommendations,
        },
        studentId,
        departmentId: student.departmentId,
        targetRole: "MENTOR",
        dedupeKey,
      },
    });
  }

  return { snapshot, risk: result };
}

export async function refreshRiskSnapshots(session: DemoSession) {
  return prisma.$transaction(async (tx) => {
    const students = await tx.student.findMany({
      where: studentScopeWhere(session),
      select: { id: true },
      take: 500,
    });
    const results = [];
    for (const student of students) {
      const current = await calculateAndPersistStudentRisk(tx, student.id);
      if (current) results.push(current.snapshot);
    }
    return results;
  }, { timeout: 60000 });
}

export async function refreshOneStudentRisk(tx: Db, studentId: string) {
  return calculateAndPersistStudentRisk(tx, studentId);
}
