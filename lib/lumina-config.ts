import type { RiskThresholds, RiskWeights } from "@/lib/risk-engine";

export interface LuminaConfiguration {
  risk: RiskThresholds;
  riskWeights: RiskWeights;
  institutionName: string;
  demoMode: boolean;
}

export const DEFAULT_LUMINA_CONFIG: LuminaConfiguration = {
  risk: {
    attendanceMinimum: 75,
    moderate: 30,
    critical: 65,
  },
  riskWeights: {
    attendance: 0.15,
    assessment: 0.4,
    assignment: 0.2,
    lab: 0.05,
    velocity: 0.2,
  },
  institutionName: "Lumina Institute",
  demoMode: true,
};
