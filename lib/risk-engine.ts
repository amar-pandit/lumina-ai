export type RiskCategory = "SAFE" | "MODERATE" | "CRITICAL";

export type RiskImpact = "High" | "Medium" | "Positive";

export interface RiskFactor {
  name: string;
  score: string;
  impact: RiskImpact;
  contribution: number;
}

export interface RiskInput {
  attendance: number;
  assessmentAverage: number;
  academicVelocity: number;
  assignmentPerformance: number;
  labCompletion: number;
}

export interface RiskResult {
  score: number;
  category: RiskCategory;
  velocity: number;
  factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskWeights {
  attendance: number;
  assessment: number;
  assignment: number;
  lab: number;
  velocity: number;
}

export interface RiskThresholds {
  attendanceMinimum: number;
  moderate: number;
  critical: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = DEFAULT_LUMINA_CONFIG.riskWeights;

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = DEFAULT_LUMINA_CONFIG.risk;

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export function calculateRisk({
  attendance,
  assessmentAverage,
  academicVelocity,
  assignmentPerformance,
  labCompletion,
}: RiskInput, weights: Partial<RiskWeights> = {}, thresholds: Partial<RiskThresholds> = {}): RiskResult {
  const values = {
    attendance: clamp(attendance),
    assessment: clamp(assessmentAverage),
    assignment: clamp(assignmentPerformance),
    lab: clamp(labCompletion),
    velocity: Number.isFinite(academicVelocity) ? academicVelocity : 0,
  };
  const appliedWeights = { ...DEFAULT_RISK_WEIGHTS, ...weights };
  const appliedThresholds = { ...DEFAULT_RISK_THRESHOLDS, ...thresholds };
  const attendanceMinimum = clamp(appliedThresholds.attendanceMinimum, 1, 100);
  const moderateThreshold = clamp(appliedThresholds.moderate, 0, 99.9);
  const criticalThreshold = clamp(appliedThresholds.critical, moderateThreshold, 100);
  const weightTotal = Object.values(appliedWeights).reduce((total, weight) => total + Math.max(0, weight), 0) || 1;
  const normalizedWeights = Object.fromEntries(
    Object.entries(appliedWeights).map(([key, weight]) => [key, Math.max(0, weight) / weightTotal]),
  ) as Record<keyof RiskWeights, number>;

  const factorScores: Record<keyof RiskWeights, number> = {
    attendance: clamp(((attendanceMinimum - values.attendance) / attendanceMinimum) * 100),
    assessment: 100 - values.assessment,
    assignment: 100 - values.assignment,
    lab: 100 - values.lab,
    velocity: clamp((Math.max(0, -values.velocity) / 3) * 100),
  };
  const score = Number(
    Object.entries(factorScores)
      .reduce((total, [key, factorScore]) => total + factorScore * normalizedWeights[key as keyof RiskWeights], 0)
      .toFixed(1),
  );

  const category: RiskCategory =
    score < moderateThreshold ? "SAFE" : score < criticalThreshold ? "MODERATE" : "CRITICAL";

  const factors: RiskFactor[] = [
    { name: "Attendance trend", score: `${Math.round(values.attendance)}%`, impact: values.attendance < attendanceMinimum ? "High" : "Positive", contribution: Number((factorScores.attendance * normalizedWeights.attendance).toFixed(1)) },
    { name: "Academic performance", score: `${Math.round(values.assessment)}/100`, impact: values.assessment < 60 ? "High" : "Medium", contribution: Number((factorScores.assessment * normalizedWeights.assessment).toFixed(1)) },
    { name: "Academic velocity", score: values.velocity.toFixed(2), impact: values.velocity < 0 ? "High" : "Positive", contribution: Number((factorScores.velocity * normalizedWeights.velocity).toFixed(1)) },
    { name: "Assignments", score: `${Math.round(values.assignment)}%`, impact: values.assignment < 70 ? "Medium" : "Positive", contribution: Number((factorScores.assignment * normalizedWeights.assignment).toFixed(1)) },
    { name: "Lab completion", score: `${Math.round(values.lab)}%`, impact: values.lab < 60 ? "Medium" : "Positive", contribution: Number((factorScores.lab * normalizedWeights.lab).toFixed(1)) },
  ];

  const recommendations = [
    ...(values.attendance < attendanceMinimum ? ["Attend upcoming classes and review the attendance recovery plan."] : []),
    ...(values.assessment < 60 ? ["Schedule focused practice for the lowest-scoring subject."] : []),
    ...(values.assignment < 70 ? ["Complete the next overdue assignment milestone."] : []),
    ...(values.lab < 60 ? ["Book a lab support session and complete missed exercises."] : []),
    ...(values.velocity < 0 ? ["Review weekly progress with a mentor to reverse the declining trend."] : []),
  ];

  return {
    score,
    category,
    velocity: values.velocity,
    factors,
    recommendations: recommendations.length > 0 ? recommendations : ["Maintain the current study and attendance routine."],
  };
}
import { DEFAULT_LUMINA_CONFIG } from "@/lib/lumina-config";
