export interface OutcomeAttainment {
  code: string;
  title: string;
  scores: number[];
  targetCutoff: number;
}

export interface AttainmentResult {
  code: string;
  title: string;
  attainment: number;
  targetCutoff: number;
  studentsAssessed: number;
}

export function calculateAttainment(outcomes: readonly OutcomeAttainment[]): AttainmentResult[] {
  return outcomes.map((outcome) => {
    const achieved = outcome.scores.filter((score) => score >= outcome.targetCutoff).length;
    const attainment = outcome.scores.length === 0 ? 0 : (achieved / outcome.scores.length) * 100;
    return {
      code: outcome.code,
      title: outcome.title,
      attainment: Number(attainment.toFixed(1)),
      targetCutoff: outcome.targetCutoff,
      studentsAssessed: outcome.scores.length,
    };
  });
}

export function attainmentCsv(rows: readonly AttainmentResult[]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = ["Outcome", "Description", "Attainment %", "Target cutoff", "Students assessed"];
  const data = rows.map((row) => [row.code, row.title, String(row.attainment), String(row.targetCutoff), String(row.studentsAssessed)]);
  return [header, ...data].map((line) => line.map(quote).join(",")).join("\r\n");
}