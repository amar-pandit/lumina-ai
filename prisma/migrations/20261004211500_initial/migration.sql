-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('STUDENT', 'FACULTY', 'MENTOR', 'HOD', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_DUTY', 'MEDICAL_LEAVE', 'OTHER_APPROVED_LEAVE', 'NOT_MARKED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('APPEARED', 'ABSENT', 'MEDICAL_LEAVE', 'ON_DUTY', 'PENDING', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('SAFE', 'MODERATE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'CONTACTED', 'ACKNOWLEDGED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('CRITICAL_RISK_CREATED', 'EXAM_ABSENCE', 'ATTENDANCE_THRESHOLD', 'INTERVENTION_ESCALATION', 'PARENT_FOLLOWUP_REQUIRED', 'HOURLY_DIGEST', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('TEST', 'DIGEST', 'ALERT');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headUserId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "departmentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mentor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "departmentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "authUserId" TEXT,
    "name" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "academicVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiredAttendance" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "departmentId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorAssignment" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyCourse" (
    "facultyId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacultyCourse_pkey" PRIMARY KEY ("facultyId","courseId","term")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "term" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "markedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'NOT_MARKED',
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceBaseline" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalClasses" INTEGER NOT NULL,
    "attendedClasses" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'CONTROLLED_DEMO_SEED',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "courseId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamParticipation" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "cia" DOUBLE PRECISION NOT NULL,
    "midterm" DOUBLE PRECISION NOT NULL,
    "lab" DOUBLE PRECISION NOT NULL,
    "assignment" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "attendance" DOUBLE PRECISION NOT NULL,
    "assessment" DOUBLE PRECISION NOT NULL,
    "velocity" DOUBLE PRECISION NOT NULL,
    "assignment" DOUBLE PRECISION NOT NULL,
    "labCompletion" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT '1',
    "inputHash" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "InterventionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentFollowUp" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "type" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "studentId" TEXT,
    "departmentId" TEXT,
    "targetRole" "RoleName",
    "targetUserId" TEXT,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailHistory" (
    "id" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientRole" "RoleName",
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "notificationEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "attendanceMinimum" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "moderateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "criticalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "attendanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "assessmentWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "assignmentWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "labWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "velocityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestSnapshot" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "digestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserRole_roleId_userId_idx" ON "UserRole"("roleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_headUserId_key" ON "Department"("headUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_userId_key" ON "Faculty"("userId");

-- CreateIndex
CREATE INDEX "Faculty_departmentId_idx" ON "Faculty"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Mentor_userId_key" ON "Mentor"("userId");

-- CreateIndex
CREATE INDEX "Mentor_departmentId_idx" ON "Mentor"("departmentId");

-- CreateIndex
CREATE INDEX "ClassGroup_departmentId_year_idx" ON "ClassGroup"("departmentId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroup_departmentId_name_key" ON "ClassGroup"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_externalId_key" ON "Student"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_authUserId_key" ON "Student"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNumber_key" ON "Student"("rollNumber");

-- CreateIndex
CREATE INDEX "Student_departmentId_year_idx" ON "Student"("departmentId", "year");

-- CreateIndex
CREATE INDEX "Student_classGroupId_idx" ON "Student"("classGroupId");

-- CreateIndex
CREATE INDEX "MentorAssignment_mentorId_isActive_endsAt_idx" ON "MentorAssignment"("mentorId", "isActive", "endsAt");

-- CreateIndex
CREATE INDEX "MentorAssignment_studentId_isActive_idx" ON "MentorAssignment"("studentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MentorAssignment_mentorId_studentId_startsAt_key" ON "MentorAssignment"("mentorId", "studentId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_departmentId_name_idx" ON "Course"("departmentId", "name");

-- CreateIndex
CREATE INDEX "FacultyCourse_courseId_term_idx" ON "FacultyCourse"("courseId", "term");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_term_isActive_idx" ON "Enrollment"("courseId", "term", "isActive");

-- CreateIndex
CREATE INDEX "Enrollment_classGroupId_term_idx" ON "Enrollment"("classGroupId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_courseId_term_key" ON "Enrollment"("studentId", "courseId", "term");

-- CreateIndex
CREATE INDEX "AttendanceSession_courseId_sessionDate_idx" ON "AttendanceSession"("courseId", "sessionDate");

-- CreateIndex
CREATE INDEX "AttendanceSession_classGroupId_sessionDate_idx" ON "AttendanceSession"("classGroupId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_courseId_classGroupId_sessionDate_key" ON "AttendanceSession"("courseId", "classGroupId", "sessionDate");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_recordedAt_idx" ON "AttendanceRecord"("studentId", "recordedAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_recordedAt_idx" ON "AttendanceRecord"("status", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBaseline_studentId_key" ON "AttendanceBaseline"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code");

-- CreateIndex
CREATE INDEX "Exam_departmentId_scheduledAt_idx" ON "Exam"("departmentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ExamParticipation_studentId_recordedAt_idx" ON "ExamParticipation"("studentId", "recordedAt");

-- CreateIndex
CREATE INDEX "ExamParticipation_status_recordedAt_idx" ON "ExamParticipation"("status", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamParticipation_examId_studentId_key" ON "ExamParticipation"("examId", "studentId");

-- CreateIndex
CREATE INDEX "Grade_courseId_term_idx" ON "Grade"("courseId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_studentId_courseId_term_key" ON "Grade"("studentId", "courseId", "term");

-- CreateIndex
CREATE INDEX "RiskSnapshot_studentId_calculatedAt_idx" ON "RiskSnapshot"("studentId", "calculatedAt");

-- CreateIndex
CREATE INDEX "RiskSnapshot_category_calculatedAt_idx" ON "RiskSnapshot"("category", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSnapshot_studentId_inputHash_key" ON "RiskSnapshot"("studentId", "inputHash");

-- CreateIndex
CREATE INDEX "Intervention_studentId_status_dueAt_idx" ON "Intervention"("studentId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Intervention_status_dueAt_idx" ON "Intervention"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ParentFollowUp_studentId_status_idx" ON "ParentFollowUp"("studentId", "status");

-- CreateIndex
CREATE INDEX "ParentFollowUp_status_urgent_dueAt_idx" ON "ParentFollowUp"("status", "urgent", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationEvent_type_occurredAt_idx" ON "NotificationEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_departmentId_occurredAt_idx" ON "NotificationEvent"("departmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_targetRole_occurredAt_idx" ON "NotificationEvent"("targetRole", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailHistory_idempotencyKey_key" ON "EmailHistory"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailHistory_recipientRole_createdAt_idx" ON "EmailHistory"("recipientRole", "createdAt");

-- CreateIndex
CREATE INDEX "EmailHistory_status_createdAt_idx" ON "EmailHistory"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailHistory_kind_createdAt_idx" ON "EmailHistory"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "DigestSnapshot_scopeKey_capturedAt_idx" ON "DigestSnapshot"("scopeKey", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSnapshot_scopeKey_digestHash_key" ON "DigestSnapshot"("scopeKey", "digestHash");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyCourse" ADD CONSTRAINT "FacultyCourse_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyCourse" ADD CONSTRAINT "FacultyCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBaseline" ADD CONSTRAINT "AttendanceBaseline_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamParticipation" ADD CONSTRAINT "ExamParticipation_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamParticipation" ADD CONSTRAINT "ExamParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFollowUp" ADD CONSTRAINT "ParentFollowUp_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailHistory" ADD CONSTRAINT "EmailHistory_notificationEventId_fkey" FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
