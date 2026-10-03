import assert from "node:assert/strict";
import test from "node:test";
import { parseVoiceCommand } from "../lib/voice-parser.ts";

test("stages the range and marks exceptions excluded, not absent", () => {
  const result = parseVoiceCommand("Roll 40 to 45 present except 42");
  assert.equal(result.type, "ATTENDANCE");
  assert.deepEqual(result.rolls, [40, 41, 42, 43, 44, 45]);
  assert.deepEqual(
    result.rows.map(({ roll, status }) => [roll, status]),
    [
      [40, "Present"],
      [41, "Present"],
      [42, "EXCLUDED"],
      [43, "Present"],
      [44, "Present"],
      [45, "Present"],
    ],
  );
});

test("parses single attendance phrases and supported variations", () => {
  for (const transcript of ["Roll 18 absent", "roll 18 is absent", "Roll 18 marked absent", "Roll 18 is ABSENT."]) {
    const result = parseVoiceCommand(transcript);
    assert.equal(result.type, "ATTENDANCE", transcript);
    assert.deepEqual(result.rolls, [18], transcript);
    assert.equal(result.rows[0]?.status, "Absent", transcript);
  }
  assert.equal(parseVoiceCommand("Roll 18 absent").confidence, 0.95);
  assert.equal(parseVoiceCommand("Roll 18 is absent").confidence, 0.9);
  assert.equal(parseVoiceCommand("Roll 18 present").rows[0]?.status, "Present");
  assert.equal(parseVoiceCommand("Roll 10 is present").status, "PRESENT");
});

test("parses hyphenated and through ranges", () => {
  for (const transcript of ["Roll 40-45 present", "Roll 40 through 45 present"]) {
    const result = parseVoiceCommand(transcript);
    assert.equal(result.type, "ATTENDANCE", transcript);
    assert.deepEqual(result.rolls, [40, 41, 42, 43, 44, 45], transcript);
    assert.ok(result.rows.every((entry) => entry.status === "Present"));
  }
});

test("parses on-duty and medical-leave statuses", () => {
  const onDuty = parseVoiceCommand("Roll 10 on duty");
  assert.equal(onDuty.status, "ON_DUTY");
  assert.equal(onDuty.rows[0]?.status, "On Duty");

  const medicalLeave = parseVoiceCommand("Roll 10 medical leave");
  assert.equal(medicalLeave.status, "MEDICAL_LEAVE");
  assert.equal(medicalLeave.rows[0]?.status, "Medical Leave");
});

test("excludes multiple rolls without assigning them an attendance status", () => {
  const result = parseVoiceCommand("Roll 40 to 45 present except 42 and 44");
  assert.deepEqual(
    result.rows.map(({ roll, status }) => [roll, status]),
    [
      [40, "Present"],
      [41, "Present"],
      [42, "EXCLUDED"],
      [43, "Present"],
      [44, "EXCLUDED"],
      [45, "Present"],
    ],
  );
});

test("parses supported grade command wording", () => {
  for (const transcript of [
    "Roll 25 score 8 out of 10",
    "Roll 25 scored 8 out of 10",
    "Roll 25 got 8 out of 10",
    "Roll 25 score is 8 out of 10",
    "ROLL 25 SCORED 8 OUT OF 10.",
  ]) {
    const result = parseVoiceCommand(transcript);
    assert.equal(result.type, "GRADE", transcript);
    assert.deepEqual(result.rolls, [25], transcript);
    assert.equal(result.score, 8, transcript);
    assert.equal(result.maxScore, 10, transcript);
    assert.equal(result.rows[0]?.score, 8, transcript);
    assert.equal(result.rows[0]?.scoreMaximum, 10, transcript);
  }
});

test("invalid grades return typed errors and never stage rows", () => {
  for (const transcript of [
    "Roll 25 score 12 out of 10",
    "Roll 25 score -1 out of 10",
    "Roll 25 score 8 out of 0",
  ]) {
    const result = parseVoiceCommand(transcript);
    assert.equal(result.type, "GRADE", transcript);
    assert.ok(result.error, transcript);
    assert.deepEqual(result.rows, [], transcript);
  }
});

test("invalid ranges return an error without creating staged rows", () => {
  const result = parseVoiceCommand("Roll 45 to 40 present");
  assert.equal(result.type, "ATTENDANCE");
  assert.ok(result.error);
  assert.equal(result.confidence, 0.7);
  assert.deepEqual(result.rows, []);
});

test("unknown commands remain unknown and do not stage rows", () => {
  const result = parseVoiceCommand("Hello");
  assert.equal(result.type, "UNKNOWN");
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.rolls, []);
  assert.deepEqual(result.rows, []);
  assert.equal(result.explanation, "Could not understand this command.");
});
