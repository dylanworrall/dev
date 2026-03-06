export interface CrawledPage {
  url: string;
  statusCode: number;
  title: string;
  metaDescription: string;
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt: string }[];
  headings: { level: number; text: string }[];
}

export interface SiteCrawl {
  id: string;
  rootUrl: string;
  timestamp: string;
  pages: CrawledPage[];
  totalPages: number;
  brokenLinks: BrokenLink[];
  redirects: Redirect[];
  projectId?: string;
}

export interface BrokenLink {
  url: string;
  statusCode: number;
  foundOn: string;
  linkText: string;
}

export interface Redirect {
  from: string;
  to: string;
  statusCode: number;
  chain: string[];
}
