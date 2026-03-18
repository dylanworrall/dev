import { tool } from "ai";
import { z } from "zod";
import * as netlify from "@/lib/netlify";
import * as vercel from "@/lib/vercel";
import * as flyio from "@/lib/flyio";
import { createDeployment, listDeployments, getDeploymentById, updateDeployment, addDeployLog } from "@/lib/stores/deployments";
import { addActivity } from "@/lib/stores/activity";

export const deploymentTools = {
  list_deployments: tool({
    description: "List deployments. If Netlify is configured, fetches real deploy history. Otherwise uses local store.",
    inputSchema: z.object({
      siteId: z.string().optional().describe("Netlify site ID (uses default if not provided)"),
      projectId: z.string().optional().describe("Filter local deployments by project ID"),
      environment: z.enum(["production", "staging", "preview", "dev"]).optional(),
      status: z.enum(["building", "deploying", "live", "failed", "rolled-back"]).optional(),
      limit: z.number().optional().describe("Number of deployments to return (default 20)"),
    }),
    execute: async ({ siteId, projectId, environment, status, limit }) => {
      // Netlify mode
      if (netlify.isNetlifyConfigured()) {
        try {
          const resolvedSiteId = netlify.resolveSiteId(siteId);
          const deploys = await netlify.deploys.list(resolvedSiteId, limit || 20);

          const mapped = deploys.map((d) => ({
            id: d.id,
            state: d.state,
            context: d.context,
            branch: d.branch,
            commitRef: d.commit_ref?.slice(0, 7) || null,
            url: d.deploy_ssl_url,
            deployUrl: d.deploy_url,
            deployTime: d.deploy_time ? `${d.deploy_time}s` : null,
            framework: d.framework,
            title: d.title,
            errorMessage: d.error_message,
            createdAt: d.created_at,
            publishedAt: d.published_at,
          }));

          return {
            message: `${mapped.length} deployment(s) from Netlify`,
            deployments: mapped,
          };
        } catch (e: unknown) {
          return { message: `Netlify error: ${(e as Error).message}` };
        }
      }

      // Local mode
      const deployments = await listDeployments({ projectId, environment, status });
      return {
        message: `${deployments.length} deployment(s)`,
        deployments: deployments.slice(0, limit || 20).map((d) => ({
          id: d.id,
          environment: d.environment,
          status: d.status,
          branch: d.branch,
          commitSha: d.commitSha.slice(0, 7),
          url: d.url,
          createdAt: d.createdAt,
        })),
      };
    },
  }),

  get_deployment: tool({
    description: "Get full details of a specific deployment.",
    inputSchema: z.object({
      deploymentId: z.string().describe("Deployment ID (Netlify deploy ID or local ID)"),
    }),
    execute: async ({ deploymentId }) => {
      // Try Netlify first
      if (netlify.isNetlifyConfigured()) {
        try {
          const deploy = await netlify.deploys.get(deploymentId);
          return {
            message: `Deploy ${deploy.id.slice(0, 8)}: ${deploy.state}`,
            deployment: {
              id: deploy.id,
              state: deploy.state,
              context: deploy.context,
              branch: deploy.branch,
              commitRef: deploy.commit_ref,
              url: deploy.deploy_ssl_url,
              deployUrl: deploy.deploy_url,
              adminUrl: deploy.admin_url,
              deployTime: deploy.deploy_time ? `${deploy.deploy_time}s` : null,
              framework: deploy.framework,
              title: deploy.title,
              errorMessage: deploy.error_message,
              screenshotUrl: deploy.screenshot_url,
              createdAt: deploy.created_at,
              publishedAt: deploy.published_at,
            },
          };
        } catch {
          // Fall through to local
        }
      }

      const deployment = await getDeploymentById(deploymentId);
      if (!deployment) return { message: "Deployment not found", deployment: null };
      return { message: `Deployment: ${deployment.environment} (${deployment.status})`, deployment };
    },
  }),

  trigger_deploy: tool({
    description: "Trigger a new deployment. Uses Netlify API if configured.",
    inputSchema: z.object({
      siteId: z.string().optional().describe("Netlify site ID (uses default if not provided)"),
      branch: z.string().optional().describe("Branch to deploy"),
      title: z.string().optional().describe("Deploy title/description"),
      clearCache: z.boolean().optional().describe("Clear build cache before deploying"),
      // Local fallback params
      projectId: z.string().optional().describe("Project ID (local mode)"),
      environment: z.enum(["production", "staging", "preview", "dev"]).optional().describe("Target environment (local mode)"),
      commitSha: z.string().optional().describe("Commit SHA (local mode)"),
    }),
    execute: async ({ siteId, branch, title, clearCache, projectId, environment, commitSha }) => {
      // Netlify mode
      if (netlify.isNetlifyConfigured()) {
        try {
          const resolvedSiteId = netlify.resolveSiteId(siteId);
          const deploy = await netlify.deploys.trigger(resolvedSiteId, {
            branch,
            title,
            clear_cache: clearCache,
          });

          await addActivity("project_created", `Triggered Netlify deploy: ${deploy.id.slice(0, 8)} (${deploy.context})`);

          return {
            message: `Deploy triggered: ${deploy.id.slice(0, 8)}`,
            deployment: {
              id: deploy.id,
              state: deploy.state,
              context: deploy.context,
              branch: deploy.branch,
              url: deploy.deploy_ssl_url,
              adminUrl: deploy.admin_url,
              createdAt: deploy.created_at,
            },
            tip: "Use get_deployment to check deploy status, or get_deploy_logs for build logs.",
          };
        } catch (e: unknown) {
          return { message: `Deploy failed: ${(e as Error).message}` };
        }
      }

      // Local mode
      if (!projectId || !environment || !commitSha) {
        return { message: "Netlify not configured. For local mode, provide projectId, environment, and commitSha." };
      }
      const deployment = await createDeployment({ projectId, environment, commitSha, branch: branch || "main" });
      await addActivity("project_created", `Deployed to ${environment} from ${branch || "main"}`);
      return { message: `Local deployment created: ${deployment.id.slice(0, 8)}`, deployment };
    },
  }),

  get_deploy_logs: tool({
    description: "Get build/deploy logs for a deployment.",
    inputSchema: z.object({
      deploymentId: z.string().describe("Deployment ID"),
    }),
    execute: async ({ deploymentId }) => {
      // Netlify mode
      if (netlify.isNetlifyConfigured()) {
        try {
          const logs = await netlify.getDeployLog(deploymentId);
          const logLines = logs.map((entry) => {
            const ts = entry.ts ? `[${entry.ts}] ` : "";
            const section = entry.section ? `(${entry.section}) ` : "";
            return `${ts}${section}${entry.message}`;
          });

          return {
            message: `${logLines.length} log line(s) for deploy ${deploymentId.slice(0, 8)}`,
            logs: logLines.slice(-100), // Last 100 lines
          };
        } catch (e: unknown) {
          return { message: `Failed to get logs: ${(e as Error).message}` };
        }
      }

      // Local mode
      const deployment = await getDeploymentById(deploymentId);
      if (!deployment) return { message: "Deployment not found", logs: [] };
      return { message: `Logs for deployment ${deploymentId.slice(0, 8)}`, logs: deployment.logs };
    },
  }),

  rollback: tool({
    description: "Rollback to a previous deployment. Uses Netlify API if configured.",
    inputSchema: z.object({
      siteId: z.string().optional().describe("Netlify site ID"),
      deploymentId: z.string().describe("The deployment ID to roll back to"),
    }),
    execute: async ({ siteId, deploymentId }) => {
      // Netlify mode
      if (netlify.isNetlifyConfigured()) {
        try {
          const resolvedSiteId = netlify.resolveSiteId(siteId);
          const deploy = await netlify.deploys.rollback(resolvedSiteId, deploymentId);

          await addActivity("project_created", `Rolled back to deploy ${deploymentId.slice(0, 8)}`);

          return {
            message: `Rolled back to deploy ${deploymentId.slice(0, 8)}`,
            deployment: {
              id: deploy.id,
              state: deploy.state,
              url: deploy.deploy_ssl_url,
              publishedAt: deploy.published_at,
            },
          };
        } catch (e: unknown) {
          return { message: `Rollback failed: ${(e as Error).message}` };
        }
      }

      // Local mode
      const deployment = await updateDeployment(deploymentId, { status: "rolled-back" });
      if (!deployment) return { message: "Deployment not found" };
      await addDeployLog(deploymentId, "Deployment rolled back");
      await addActivity("project_created", `Rolled back deployment ${deploymentId.slice(0, 8)}`);
      return { message: `Rolled back deployment ${deploymentId.slice(0, 8)}` };
    },
  }),

  list_sites: tool({
    description: "List all Netlify sites connected to your account.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!netlify.isNetlifyConfigured()) {
        return { message: "Netlify not configured. Set NETLIFY_TOKEN to enable." };
      }
      try {
        const siteList = await netlify.sites.list();
        return {
          message: `${siteList.length} Netlify site(s)`,
          sites: siteList.map((s) => ({
            id: s.id,
            name: s.name,
            url: s.ssl_url,
            customDomain: s.custom_domain,
            repo: s.repo ? `${s.repo.provider}:${s.repo.repo_path}` : null,
            updatedAt: s.updated_at,
          })),
        };
      } catch (e: unknown) {
        return { message: `Netlify error: ${(e as Error).message}` };
      }
    },
  }),

  // --- Vercel ---

  vercel_list_projects: tool({
    description: "List all Vercel projects. Best for static sites, Next.js, and serverless apps.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!vercel.isVercelConfigured()) return { message: "Vercel not configured. Set VERCEL_TOKEN." };
      try {
        const { projects: list } = await vercel.projects.list();
        return {
          message: `${list.length} Vercel project(s)`,
          projects: list.map((p) => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            repo: p.link ? `${p.link.type}:${p.link.repo}` : null,
          })),
        };
      } catch (e: unknown) {
        return { message: `Vercel error: ${(e as Error).message}` };
      }
    },
  }),

  vercel_deploy: tool({
    description: "List recent Vercel deployments, or trigger a deploy by connecting a GitHub repo to a Vercel project.",
    inputSchema: z.object({
      action: z.enum(["list", "create_project"]).describe("'list' to see deployments, 'create_project' to set up a new Vercel project"),
      projectName: z.string().optional().describe("Project name (for create)"),
      framework: z.string().optional().describe("Framework (nextjs, react, etc.)"),
      githubRepo: z.string().optional().describe("GitHub repo (owner/repo) to connect"),
      projectId: z.string().optional().describe("Vercel project ID (for listing deploys)"),
    }),
    execute: async ({ action, projectName, framework, githubRepo, projectId }) => {
      if (!vercel.isVercelConfigured()) return { message: "Vercel not configured. Set VERCEL_TOKEN." };
      try {
        if (action === "list") {
          const { deployments: deps } = await vercel.deployments.list(projectId);
          return {
            message: `${deps.length} Vercel deployment(s)`,
            deployments: deps.slice(0, 20).map((d) => ({
              id: d.uid,
              url: `https://${d.url}`,
              state: d.state,
              target: d.target,
              commit: d.meta?.githubCommitMessage?.slice(0, 60) || null,
              created: new Date(d.created).toISOString(),
            })),
          };
        }

        if (action === "create_project" && projectName) {
          const data: Parameters<typeof vercel.projects.create>[0] = { name: projectName };
          if (framework) data.framework = framework;
          if (githubRepo) data.gitRepository = { type: "github", repo: githubRepo };
          const project = await vercel.projects.create(data);
          await addActivity("project_created", `Created Vercel project: ${project.name}`);
          return {
            message: `Created Vercel project: ${project.name}`,
            project: { id: project.id, name: project.name, framework: project.framework },
            tip: "Push to the connected GitHub repo to trigger deploys automatically.",
          };
        }

        return { message: "Specify action: 'list' or 'create_project'" };
      } catch (e: unknown) {
        return { message: `Vercel error: ${(e as Error).message}` };
      }
    },
  }),

  // --- Fly.io ---

  fly_list_apps: tool({
    description: "List all Fly.io apps. Best for backend services, APIs, databases, and anything that needs a VPS/container.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!flyio.isFlyConfigured()) return { message: "Fly.io not configured. Set FLY_API_TOKEN." };
      try {
        const appList = await flyio.apps.list();
        return {
          message: `${appList.length} Fly.io app(s)`,
          apps: appList.map((a) => ({
            name: a.name,
            status: a.status,
            hostname: a.hostname,
            org: a.organization.slug,
          })),
        };
      } catch (e: unknown) {
        return { message: `Fly.io error: ${(e as Error).message}` };
      }
    },
  }),

  fly_deploy: tool({
    description: "Create a Fly.io app or deploy to an existing one. Use for backends, APIs, databases — anything needing a VPS/container.",
    inputSchema: z.object({
      action: z.enum(["create", "deploy", "status", "list_machines"]).describe("Action to perform"),
      appName: z.string().describe("Fly.io app name"),
      cwd: z.string().optional().describe("Working directory for deploy (must have a Dockerfile or fly.toml)"),
    }),
    execute: async ({ action, appName, cwd }) => {
      if (!flyio.isFlyConfigured()) return { message: "Fly.io not configured. Set FLY_API_TOKEN." };
      try {
        if (action === "create") {
          const app = await flyio.apps.create({ app_name: appName });
          await addActivity("project_created", `Created Fly.io app: ${app.name}`);
          return {
            message: `Created Fly.io app: ${app.name}`,
            app: { name: app.name, hostname: app.hostname, status: app.status },
            tip: "Add a Dockerfile to your project, then use fly_deploy with action='deploy'.",
          };
        }

        if (action === "deploy" && cwd) {
          const result = await flyio.deployWithCli(appName, cwd);
          return {
            message: result.exitCode === 0 ? `Deployed to ${appName}.fly.dev` : `Deploy failed`,
            exitCode: result.exitCode,
            stdout: result.stdout.slice(-2000),
            stderr: result.stderr.slice(-1000),
            url: result.exitCode === 0 ? `https://${appName}.fly.dev` : null,
          };
        }

        if (action === "status") {
          const app = await flyio.apps.get(appName);
          const machineList = await flyio.machines.list(appName);
          return {
            message: `${appName}: ${app.status} (${machineList.length} machine(s))`,
            app: { name: app.name, status: app.status, hostname: app.hostname },
            machines: machineList.map((m) => ({
              id: m.id,
              state: m.state,
              region: m.region,
              image: m.image_ref?.repository || null,
            })),
          };
        }

        if (action === "list_machines") {
          const machineList = await flyio.machines.list(appName);
          return {
            message: `${machineList.length} machine(s) for ${appName}`,
            machines: machineList.map((m) => ({
              id: m.id,
              name: m.name,
              state: m.state,
              region: m.region,
            })),
          };
        }

        return { message: "Specify action: create, deploy, status, or list_machines" };
      } catch (e: unknown) {
        return { message: `Fly.io error: ${(e as Error).message}` };
      }
    },
  }),

  // --- Platform status ---

  deployment_platforms: tool({
    description: "Check which deployment platforms are configured and available.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        message: "Deployment platform status",
        platforms: {
          netlify: { configured: netlify.isNetlifyConfigured(), best_for: "Static sites, JAMstack, frontend apps" },
          vercel: { configured: vercel.isVercelConfigured(), best_for: "Next.js, React, serverless functions" },
          flyio: { configured: flyio.isFlyConfigured(), best_for: "Backend services, APIs, databases, Docker containers" },
        },
        tip: "Use configure_integration to set up tokens for any platform.",
      };
    },
  }),
};
