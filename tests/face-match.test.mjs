import assert from "node:assert/strict";
import test from "node:test";
import {
  FACE_DESCRIPTOR_SIZE,
  findFaceMatch,
  isFaceDescriptorSet,
} from "../lib/face-auth/match.ts";

function descriptor(seed, offset = 0) {
  return Array.from({ length: FACE_DESCRIPTOR_SIZE }, (_, index) =>
    index === 0 ? seed + offset : Math.sin(seed + index) * 0.1 + offset,
  );
}

test("face matching maps a verified descriptor to its uniquely registered user ID", () => {
  const student = [descriptor(0.1), descriptor(0.1, 0.001), descriptor(0.1, -0.001)];
  const faculty = [descriptor(0.8), descriptor(0.8, 0.001), descriptor(0.8, -0.001)];
  assert.equal(
    findFaceMatch(student, [
      { userId: "student-demo-001", descriptors: student },
      { userId: "faculty-demo-001", descriptors: faculty },
    ]),
    "student-demo-001",
  );
  assert.equal(
    findFaceMatch(faculty, [
      { userId: "student-demo-001", descriptors: student },
      { userId: "faculty-demo-001", descriptors: faculty },
    ]),
    "faculty-demo-001",
  );
});

test("face matching rejects unknown, malformed, and ambiguous identities", () => {
  const registered = [descriptor(0.1), descriptor(0.1, 0.001), descriptor(0.1, -0.001)];
  assert.equal(
    findFaceMatch([descriptor(1.8), descriptor(1.8), descriptor(1.8)], [
      { userId: "student-demo-001", descriptors: registered },
    ]),
    null,
  );
  assert.equal(findFaceMatch([[1, 2, 3]], [{ userId: "student-demo-001", descriptors: registered }]), null);
  assert.equal(
    findFaceMatch(registered, [
      { userId: "student-demo-001", descriptors: registered },
      { userId: "faculty-demo-001", descriptors: registered },
    ]),
    null,
  );
});

test("registration input requires three valid 128-value face descriptors", () => {
  assert.equal(isFaceDescriptorSet([descriptor(0), descriptor(0.1), descriptor(0.2)]), true);
  assert.equal(isFaceDescriptorSet([descriptor(0)]), false);
  assert.equal(isFaceDescriptorSet([descriptor(0), descriptor(0.1), [Number.NaN]]), false);
});
