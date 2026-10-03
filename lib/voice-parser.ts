export type VoiceCommandType = "ATTENDANCE" | "GRADE" | "UNKNOWN";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "ON_DUTY" | "MEDICAL_LEAVE";

export type ParsedAttendanceRowStatus =
  | "Present"
  | "Absent"
  | "On Duty"
  | "Medical Leave"
  | "Scored"
  | "EXCLUDED";

export interface ParsedAttendanceRow {
  roll: number;
  status: ParsedAttendanceRowStatus;
  score: number | null;
  scoreMaximum: number | null;
  confidence: number;
}

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  rolls: number[];
  status?: AttendanceStatus;
  score?: number;
  maxScore?: number;
  confidence: number;
  originalTranscript: string;
  explanation: string;
  error?: string;
  rows: ParsedAttendanceRow[];
  summary: string;
}

const MAX_RANGE_SIZE = 100;

function normalizeTranscript(transcript: string): string {
  return transcript
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}

function row(
  roll: number,
  status: ParsedAttendanceRowStatus,
  confidence: number,
  score: number | null = null,
  scoreMaximum: number | null = null,
): ParsedAttendanceRow {
  return { roll, status, score, scoreMaximum, confidence };
}

function statusLabel(status: AttendanceStatus): ParsedAttendanceRowStatus {
  switch (status) {
    case "PRESENT":
      return "Present";
    case "ABSENT":
      return "Absent";
    case "ON_DUTY":
      return "On Duty";
    case "MEDICAL_LEAVE":
      return "Medical Leave";
  }
}

function unknownCommand(originalTranscript: string): ParsedVoiceCommand {
  return {
    type: "UNKNOWN",
    rolls: [],
    confidence: 0,
    originalTranscript,
    explanation: "Could not understand this command.",
    rows: [],
    summary: "Could not understand this command.",
  };
}

function invalidCommand(
  originalTranscript: string,
  type: Exclude<VoiceCommandType, "UNKNOWN">,
  rolls: number[],
  error: string,
  confidence = 0.7,
): ParsedVoiceCommand {
  return {
    type,
    rolls,
    confidence,
    originalTranscript,
    explanation: error,
    error,
    rows: [],
    summary: error,
  };
}

export function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  const originalTranscript = transcript;
  const text = normalizeTranscript(transcript);
  if (!text) return unknownCommand(originalTranscript);

  const gradeMatch = text.match(
    /^roll\s+(\d+)\s+(score(?:d)?|got)(?:\s+(is))?\s+(-?\d+(?:\.\d+)?)\s+out\s+of\s+(-?\d+(?:\.\d+)?)$/,
  );
  if (gradeMatch) {
    const rollNumber = Number(gradeMatch[1]);
    const score = Number(gradeMatch[4]);
    const maxScore = Number(gradeMatch[5]);
    const operation = gradeMatch[2];
    const confidence = operation === "score" && !gradeMatch[3] ? 0.95 : 0.9;

    if (score < 0 || maxScore <= 0 || score > maxScore) {
      return {
        ...invalidCommand(
          originalTranscript,
          "GRADE",
          [rollNumber],
          "Score must be at least 0, maximum score must be greater than 0, and score cannot exceed the maximum.",
        ),
        score,
        maxScore,
      };
    }

    return {
      type: "GRADE",
      rolls: [rollNumber],
      score,
      maxScore,
      confidence,
      originalTranscript,
      explanation: `Grade ${score}/${maxScore} staged for roll ${rollNumber}.`,
      rows: [row(rollNumber, "Scored", confidence, score, maxScore)],
      summary: `Roll ${rollNumber} score staged (${score}/${maxScore})`,
    };
  }

  const attendanceMatch = text.match(
    /^roll\s+(\d+)(?:(\s+to\s+|\s+through\s+|-)(\d+))?\s+(?:(is|marked)\s+)?(present|absent|on\s+duty|medical\s+leave)(?:\s+except\s+(\d+(?:\s*(?:,|and)\s*\d+)*))?$/,
  );
  if (!attendanceMatch) return unknownCommand(originalTranscript);

  const startRoll = Number(attendanceMatch[1]);
  const hasRange = attendanceMatch[3] !== undefined;
  const endRoll = hasRange ? Number(attendanceMatch[3]) : startRoll;
  const modifier = attendanceMatch[4];
  const statusText = attendanceMatch[5].replace(/\s+/g, " ").toUpperCase();
  const status: AttendanceStatus = statusText === "PRESENT"
    ? "PRESENT"
    : statusText === "ABSENT"
      ? "ABSENT"
      : statusText === "ON DUTY"
        ? "ON_DUTY"
        : "MEDICAL_LEAVE";
  const exceptions = (attendanceMatch[6]?.match(/\d+/g) ?? []).map(Number);

  if (startRoll > endRoll) {
    return invalidCommand(originalTranscript, "ATTENDANCE", [], "Roll range start must not exceed its end.");
  }

  if (endRoll - startRoll + 1 > MAX_RANGE_SIZE) {
    return invalidCommand(originalTranscript, "ATTENDANCE", [], `Roll ranges are limited to ${MAX_RANGE_SIZE} entries.`);
  }

  const rolls = Array.from({ length: endRoll - startRoll + 1 }, (_, index) => startRoll + index);
  if (exceptions.some((rollNumber) => !rolls.includes(rollNumber))) {
    return invalidCommand(originalTranscript, "ATTENDANCE", rolls, "Every excluded roll must be within the stated range.");
  }

  const confidence = modifier || (hasRange && attendanceMatch[2] !== " to ") ? 0.9 : 0.95;
  const excluded = new Set(exceptions);
  const attendanceLabel = statusLabel(status);
  const rows = rolls.map((rollNumber) => (
    excluded.has(rollNumber)
      ? row(rollNumber, "EXCLUDED", confidence)
      : row(rollNumber, attendanceLabel, confidence)
  ));
  const excludedCount = excluded.size;
  const changedCount = rows.length - excludedCount;

  return {
    type: "ATTENDANCE",
    rolls,
    status,
    confidence,
    originalTranscript,
    explanation: excludedCount > 0
      ? `${changedCount} roll(s) staged as ${attendanceLabel}; ${excludedCount} excluded roll(s) will remain unchanged.`
      : `${rolls.length} roll(s) staged as ${attendanceLabel}.`,
    rows,
    summary: excludedCount > 0
      ? `${changedCount} ${attendanceLabel.toLowerCase()}, ${excludedCount} excluded`
      : hasRange
        ? `${rolls.length} ${attendanceLabel.toLowerCase()}`
        : `Roll ${startRoll} marked ${attendanceLabel.toLowerCase()}`,
  };
}
