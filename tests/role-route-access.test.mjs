import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRoute, dashboardForRole } from "../lib/auth-types.ts";

test("HOD can access only HOD routes and explicitly shared dashboard modules", () => {
  for (const route of [
    "/hod/dashboard",
    "/hod/analytics",
    "/faculty/courses/demo/attendance-grid",
    "/faculty/courses/demo/gradebook",
    "/mentor/dashboard",
  ]) {
    assert.equal(canAccessRoute("HOD", route), true, route);
  }

  for (const route of [
    "/faculty/voice-entry",
    "/faculty/dashboard",
    "/faculty/interventions",
    "/faculty/courses/demo/heatmap",
    "/faculty/courses/demo/remedial",
    "/admin/dashboard",
  ]) {
    assert.equal(canAccessRoute("HOD", route), false, route);
  }
});

test("Faculty retains voice attendance, attendance grid, and gradebook", () => {
  for (const route of [
    "/faculty/voice-entry",
    "/faculty/courses/demo/attendance-grid",
    "/faculty/courses/demo/gradebook",
  ]) {
    assert.equal(canAccessRoute("FACULTY", route), true, route);
  }
});

test("HOD and Admin remain separate dashboard identities", () => {
  assert.equal(dashboardForRole("HOD"), "/hod/dashboard");
  assert.equal(dashboardForRole("ADMIN"), "/admin/dashboard");
  assert.equal(canAccessRoute("HOD", "/admin/settings"), false);
});
