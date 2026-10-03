export interface ReportDocument {
  title: string;
  type: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  summary?: Array<[string, string | number]>;
  period?: string;
  filters?: Record<string, string>;
}

export interface ReportHistoryItem {
  reportId: string;
  reportName: string;
  reportType: string;
  generatedBy: string;
  generatedByRole: string;
  generatedAt: string;
  period: string;
  filters: Record<string, string>;
}
