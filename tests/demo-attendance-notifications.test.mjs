import assert from "node:assert/strict";
import test from "node:test";
import { facultyStudents } from "../lib/demo-data.ts";
import {
  DEMO_FACULTY_COURSE_ASSIGNMENTS,
  buildAdminInstitutionEmail,
  buildFacultyCourseEmail,
  buildHODDepartmentEmail,
  buildMentorAttendanceEmail,
  getAdminInstitutionData,
  getFacultyCourseData,
  getHODDepartmentData,
  getMentorAttendanceData,
} from "../lib/demo-attendance-notifications.ts";
import { HOD_DEPARTMENT } from "../lib/hod-data.ts";

const statuses = ["Present", "Absent", "On Duty", "Medical Leave"];
const attendance = facultyStudents.map((student, index) => ({
  studentId: student.id,
  course: student.course,
  status: statuses[index % statuses.length],
}));
const leadership = {
  studentMetrics: facultyStudents.map((student) => ({
    studentId: student.id,
    assessmentAverage: student.assessmentAverage,
    riskCategory: student.status,
  })),
  interventions: facultyStudents.slice(0, 3).map((student, index) => ({
    student: student.name,
    status: index === 0 ? "Scheduled" : "Completed",
  })),
  escalatedStudentIds: [1, 2],
  parentFollowUpStudentIds: [1, 3],
};
const now = "2026-10-04T16:00:00.000Z";

test("mentor email contains only attendance data for its mapped, assigned students", () => {
  const course = "Data Structures";
  const data = getMentorAttendanceData("mentor-demo-001", course, attendance, now);
  const email = buildMentorAttendanceEmail(data);
  const expected = facultyStudents.filter((student) => student.course === course && student.mentor === "Dr. Meera Shah");

  assert.equal(data.counts.total, expected.length);
  assert.equal(data.counts.present + data.counts.absent + data.counts.od + data.counts.medicalLeave, expected.length);
  assert.match(email.subject, /Mentor Attendance Update/);
  assert.match(email.body, /Class\/Section: Demo Roll Register/);
  for (const student of expected) assert.ok(email.body.includes(student.name));
  for (const student of facultyStudents.filter((entry) => !expected.includes(entry))) {
    assert.ok(!email.body.includes(student.name));
  }
  assert.doesNotMatch(email.body, /marks|gradebook|CIA|midterm|lab marks|assignment|exam|risk|department|institution/i);
});

test("faculty course selector returns only assigned subject students and subject marks", () => {
  const assignedCourse = DEMO_FACULTY_COURSE_ASSIGNMENTS["faculty-demo-001"][0];
  const data = getFacultyCourseData("faculty-demo-001", assignedCourse, attendance);

  assert.ok(data);
  assert.ok(data.students.every((student) => facultyStudents.some((source) =>
    source.course === assignedCourse && source.name === student.name)));
  assert.equal(getFacultyCourseData("faculty-demo-001", "Unassigned Course", attendance), null);
  const email = buildFacultyCourseEmail(data);
  assert.match(email.subject, new RegExp(assignedCourse));
  assert.match(email.body, /Subject marks:/);
  assert.match(email.body, /Exam participation:/);
  assert.doesNotMatch(email.body, /Institution-wide|Department-wise/);
});

test("HOD email summarizes only the configured department", () => {
  const data = getHODDepartmentData(attendance, leadership, now);
  const email = buildHODDepartmentEmail(data);
  const departmentStudents = facultyStudents.filter((student) => student.department === HOD_DEPARTMENT);
  const otherDepartment = facultyStudents.find((student) => student.department !== HOD_DEPARTMENT);

  assert.equal(data.department, HOD_DEPARTMENT);
  assert.equal(data.attendance.total, departmentStudents.length);
  assert.match(email.body, new RegExp(`Department: ${HOD_DEPARTMENT}`));
  assert.match(email.body, /Exam participation:/);
  assert.match(email.body, /Academic performance:/);
  assert.match(email.body, /Risk summary:/);
  assert.match(email.body, /Interventions:/);
  assert.match(email.body, /Escalations:/);
  assert.match(email.body, /Parent follow-ups:/);
  if (otherDepartment) assert.ok(!email.body.includes(otherDepartment.name));
  assert.doesNotMatch(email.body, /Institution-wide summary|Department-wise attendance:/);
});

test("Admin email contains institution and department attendance summaries", () => {
  const data = getAdminInstitutionData(attendance, leadership, now);
  const email = buildAdminInstitutionEmail(data);

  assert.equal(data.attendance.total, facultyStudents.length);
  assert.equal(data.departmentAttendance?.reduce((total, item) => total + item.counts.total, 0), facultyStudents.length);
  assert.match(email.body, /Admin Institution Update/);
  assert.match(email.body, /Department-wise attendance:/);
  assert.match(email.body, /Exam participation:/);
  assert.match(email.body, /Risk summary:/);
  assert.match(email.body, /Interventions:/);
  assert.match(email.body, /Escalations:/);
  assert.match(email.body, /Parent follow-ups:/);
  assert.doesNotMatch(email.body, /Present Students:/);
});
