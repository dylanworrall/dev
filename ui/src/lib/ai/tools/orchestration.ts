import { tool } from "ai";
import { z } from "zod";
import * as github from "@/lib/github";
import * as netlify from "@/lib/netlify";
import { addActivity } from "@/lib/stores/activity";

export const orchestrationTools = {
  deploy_and_audit: tool({
    description: "Deploy a site via Netlify, wait for it to go live, then automatically run a Lighthouse audit on the deployed URL.",
    inputSchema: z.object({
      siteId: z.string().optional().describe("Netlify site ID (uses default if not provided)"),
      branch: z.string().optional().describe("Branch to deploy"),
      title: z.string().optional().describe("Deploy title"),
      auditUrl: z.string().optional().describe("URL to audit after deploy (auto-detected from Netlify if not provided)"),
    }),
    execute: async ({ siteId, branch, title, auditUrl }) => {
      try {
        if (!netlify.isNetlifyConfigured()) {
          return { message: "Netlify not configured. Set NETLIFY_TOKEN to enable deploy-and-audit." };
        }

        const resolvedSiteId = netlify.resolveSiteId(siteId);

        // 1. Trigger deploy
        const deploy = await netlify.deploys.trigger(resolvedSiteId, { branch, title });

        // 2. Poll for completion (up to 120 seconds)
        let currentDeploy = deploy;
        const maxWait = 120_000;
        const pollInterval = 5_000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          if (currentDeploy.state === "ready" || currentDeploy.state === "error") break;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          currentDeploy = await netlify.deploys.get(deploy.id);
        }

        if (currentDeploy.state === "error") {
          return {
            message: `Deploy failed: ${currentDeploy.error_message || "unknown error"}`,
            deployment: { id: deploy.id, state: "error", error: currentDeploy.error_message },
          };
        }

        if (currentDeploy.state !== "ready") {
          return {
            message: `Deploy still in progress after 2 minutes. Check status with get_deployment.`,
            deployment: { id: deploy.id, state: currentDeploy.state },
            tip: "Run get_deployment and run_lighthouse separately once deploy completes.",
          };
        }

        // 3. Run audit on the deployed URL
        const urlToAudit = auditUrl || currentDeploy.deploy_ssl_url || currentDeploy.url;
        const { loadDevEnv } = await import("@/lib/env");
        loadDevEnv();
        const googleKey = process.env.GOOGLE_API_KEY;

        let auditResult = null;
        if (googleKey && urlToAudit) {
          const apiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToAudit)}&key=${googleKey}&strategy=mobile&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;
          const auditRes = await fetch(apiUrl);
          if (auditRes.ok) {
            const data = await auditRes.json() as Record<string, unknown>;
            const categories = (data.lighthouseResult as Record<string, unknown>)?.categories as Record<string, { score: number; title: string }> | undefined;
            if (categories) {
              auditResult = {
                performance: Math.round((categories.performance?.score || 0) * 100),
                seo: Math.round((categories.seo?.score || 0) * 100),
                accessibility: Math.round((categories.accessibility?.score || 0) * 100),
                bestPractices: Math.round((categories["best-practices"]?.score || 0) * 100),
              };
            }
          }
        }

        await addActivity("audit_run", `Deploy & audit: ${urlToAudit} — Performance: ${auditResult?.performance || "N/A"}`);

        return {
          message: `Deployed and audited: ${urlToAudit}`,
          deployment: {
            id: currentDeploy.id,
            state: currentDeploy.state,
            url: urlToAudit,
            deployTime: currentDeploy.deploy_time ? `${currentDeploy.deploy_time}s` : null,
          },
          audit: auditResult || "Audit skipped (no GOOGLE_API_KEY or URL)",
        };
      } catch (e: unknown) {
        return { message: `Deploy & audit failed: ${(e as Error).message}` };
      }
    },
  }),

  audit_and_create_issues: tool({
    description: "Run a Lighthouse audit on a URL and automatically create GitHub issues for any problems found.",
    inputSchema: z.object({
      url: z.string().describe("URL to audit"),
      repoName: z.string().describe("GitHub repo (owner/repo) to create issues in"),
      minScore: z.number().optional().describe("Create issues for categories scoring below this (default: 90)"),
      labels: z.array(z.string()).optional().describe("Additional labels for created issues"),
    }),
    execute: async ({ url, repoName, minScore, labels }) => {
      try {
        if (!github.isGitHubConfigured()) {
          return { message: "GitHub not configured. Set GITHUB_TOKEN to enable." };
        }

        const { loadDevEnv } = await import("@/lib/env");
        loadDevEnv();
        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return { message: "GOOGLE_API_KEY not configured. Required for audits." };

        const { owner, repo } = github.parseRepoName(repoName);
        const threshold = minScore || 90;

        // Run audit
        const apiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${googleKey}&strategy=mobile&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;
        const auditRes = await fetch(apiUrl);
        if (!auditRes.ok) return { message: `Audit failed: ${auditRes.status}` };

        const data = await auditRes.json() as Record<string, unknown>;
        const lhResult = data.lighthouseResult as Record<string, unknown> | undefined;
        const categories = lhResult?.categories as Record<string, { score: number; title: string }> | undefined;
        const audits = lhResult?.audits as Record<string, { score: number | null; title: string; description: string; displayValue?: string }> | undefined;

        if (!categories) return { message: "Audit returned no category data" };

        const scores: Record<string, number> = {};
        const issuesCreated: Array<{ number: number; title: string; category: string; url: string }> = [];
        const baseLabels = ["audit", "automated", ...(labels || [])];

        for (const [key, cat] of Object.entries(categories)) {
          const score = Math.round(cat.score * 100);
          scores[key] = score;

          if (score < threshold) {
            // Find failing audits in this category
            const failingAudits: string[] = [];
            if (audits) {
              for (const [, audit] of Object.entries(audits)) {
                if (audit.score !== null && audit.score < 0.9) {
                  failingAudits.push(`- **${audit.title}**: ${audit.displayValue || "needs improvement"}\n  ${audit.description.split(".")[0]}.`);
                }
              }
            }

            const issueBody = [
              `## ${cat.title} Audit Results`,
              `**URL:** ${url}`,
              `**Score:** ${score}/100 (threshold: ${threshold})`,
              `**Date:** ${new Date().toISOString().split("T")[0]}`,
              "",
              "### Failing Checks",
              failingAudits.slice(0, 10).join("\n") || "See Lighthouse report for details.",
              "",
              `_Auto-generated by Dev Client audit_`,
            ].join("\n");

            const issue = await github.issues.create(owner, repo, {
              title: `[Audit] ${cat.title} score ${score}/100 on ${new URL(url).hostname}`,
              body: issueBody,
              labels: [...baseLabels, key, score < 50 ? "critical" : "improvement"],
            });

            issuesCreated.push({ number: issue.number, title: issue.title, category: key, url: issue.html_url });
          }
        }

        await addActivity("audit_run", `Audit & issues: ${url} — ${issuesCreated.length} issue(s) created`);

        return {
          message: `Audited ${url}: ${issuesCreated.length} issue(s) created in ${owner}/${repo}`,
          scores,
          issuesCreated,
        };
      } catch (e: unknown) {
        return { message: `Audit & issues failed: ${(e as Error).message}` };
      }
    },
  }),

  full_pipeline: tool({
    description: "Full pipeline: deploy to Netlify → audit the deployed site → create GitHub issues for any problems. The ultimate autonomous workflow.",
    inputSchema: z.object({
      siteId: z.string().optional().describe("Netlify site ID"),
      repoName: z.string().describe("GitHub repo (owner/repo) for issues"),
      branch: z.string().optional().describe("Branch to deploy"),
      minScore: z.number().optional().describe("Issue threshold score (default: 90)"),
    }),
    execute: async ({ siteId, repoName, branch, minScore }) => {
      try {
        if (!netlify.isNetlifyConfigured()) return { message: "Netlify not configured." };
        if (!github.isGitHubConfigured()) return { message: "GitHub not configured." };

        const { loadDevEnv } = await import("@/lib/env");
        loadDevEnv();
        if (!process.env.GOOGLE_API_KEY) return { message: "GOOGLE_API_KEY not configured." };

        const resolvedSiteId = netlify.resolveSiteId(siteId);
        const { owner, repo } = github.parseRepoName(repoName);
        const threshold = minScore || 90;

        // Step 1: Deploy
        const deploy = await netlify.deploys.trigger(resolvedSiteId, { branch });

        // Step 2: Wait for deploy
        let currentDeploy = deploy;
        const start = Date.now();
        while (Date.now() - start < 120_000) {
          if (currentDeploy.state === "ready" || currentDeploy.state === "error") break;
          await new Promise((r) => setTimeout(r, 5_000));
          currentDeploy = await netlify.deploys.get(deploy.id);
        }

        if (currentDeploy.state !== "ready") {
          return {
            message: `Deploy did not complete in time. State: ${currentDeploy.state}`,
            deployId: deploy.id,
          };
        }

        const deployUrl = currentDeploy.deploy_ssl_url || currentDeploy.url;

        // Step 3: Audit
        const apiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(deployUrl)}&key=${process.env.GOOGLE_API_KEY}&strategy=mobile&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;
        const auditRes = await fetch(apiUrl);

        let scores: Record<string, number> = {};
        const issuesCreated: Array<{ number: number; title: string; url: string }> = [];

        if (auditRes.ok) {
          const data = await auditRes.json() as Record<string, unknown>;
          const categories = (data.lighthouseResult as Record<string, unknown>)?.categories as Record<string, { score: number; title: string }> | undefined;

          if (categories) {
            for (const [key, cat] of Object.entries(categories)) {
              const score = Math.round(cat.score * 100);
              scores[key] = score;

              if (score < threshold) {
                const issue = await github.issues.create(owner, repo, {
                  title: `[Pipeline] ${cat.title} score ${score}/100 — ${new URL(deployUrl).hostname}`,
                  body: `Automated pipeline detected low ${cat.title} score.\n\n**URL:** ${deployUrl}\n**Score:** ${score}/100\n**Deploy:** ${deploy.id.slice(0, 8)}\n**Branch:** ${branch || "production"}\n\n_Auto-generated by Dev Client pipeline_`,
                  labels: ["pipeline", "audit", key, score < 50 ? "critical" : "improvement"],
                });
                issuesCreated.push({ number: issue.number, title: issue.title, url: issue.html_url });
              }
            }
          }
        }

        await addActivity("audit_run", `Full pipeline: ${deployUrl} — ${Object.values(scores).join("/")} — ${issuesCreated.length} issue(s)`);

        return {
          message: `Pipeline complete: deployed → audited → ${issuesCreated.length} issue(s) created`,
          deploy: {
            id: currentDeploy.id,
            url: deployUrl,
            deployTime: currentDeploy.deploy_time ? `${currentDeploy.deploy_time}s` : null,
          },
          audit: scores,
          issues: issuesCreated,
        };
      } catch (e: unknown) {
        return { message: `Pipeline failed: ${(e as Error).message}` };
      }
    },
  }),
};
