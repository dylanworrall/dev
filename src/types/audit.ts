export interface AuditScores {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  description: string;
  score: number | null;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface AuditResult {
  id: string;
  url: string;
  timestamp: string;
  source: "lighthouse" | "pagespeed";
  scores: AuditScores;
  issues: AuditIssue[];
  coreWebVitals?: CoreWebVitals;
  projectId?: string;
}

export interface CoreWebVitals {
  lcp: { value: number; rating: "good" | "needs-improvement" | "poor" };
  inp: { value: number; rating: "good" | "needs-improvement" | "poor" };
  cls: { value: number; rating: "good" | "needs-improvement" | "poor" };
}
