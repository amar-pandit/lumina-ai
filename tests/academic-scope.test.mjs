import assert from "node:assert/strict";
import test from "node:test";
import { studentScopeWhere } from "../lib/academic-scope.ts";

const user = (role, id = "account-1") => ({
  role,
  user: { id, name: "Test Account", email: "test@example.invalid", role },
  authenticated: true,
});

test("student database scope is restricted to the authenticated identity", () => {
  assert.deepEqual(studentScopeWhere(user("STUDENT")), { authUserId: "account-1" });
});

test("mentor and HOD scopes derive from server-side assignments", () => {
  const mentorScope = studentScopeWhere(user("MENTOR"));
  assert.equal(mentorScope.mentorAssignments.some.mentor.userId, "account-1");
  assert.equal(mentorScope.mentorAssignments.some.isActive, true);
  assert.equal(mentorScope.mentorAssignments.some.OR.length, 2);
  assert.deepEqual(studentScopeWhere(user("HOD")), { department: { headUserId: "account-1" } });
});

test("faculty scope is limited to active enrollments in assigned courses", () => {
  const scope = studentScopeWhere(user("FACULTY"));
  assert.deepEqual(scope, {
    enrollments: {
      some: {
        isActive: true,
        course: { faculty: { some: { faculty: { userId: "account-1" } } } },
      },
    },
  });
});

test("institution-wide scope is granted only to the authenticated Admin role", () => {
  assert.deepEqual(studentScopeWhere(user("ADMIN")), {});
  assert.notDeepEqual(studentScopeWhere(user("HOD")), {});
  assert.notDeepEqual(studentScopeWhere(user("MENTOR")), {});
});
