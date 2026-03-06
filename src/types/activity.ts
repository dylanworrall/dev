export interface ActivityLogEntry {
  id: string;
  type: "audit_run" | "crawl_run" | "project_created" | "seo_analysis" | "sitemap_generated";
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
