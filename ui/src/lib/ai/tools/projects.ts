import { tool } from "ai";
import { z } from "zod";
import { createProject, listProjects, getProjectById } from "@/lib/stores/projects";
import { getAudits } from "@/lib/stores/audits";
import { getCrawls } from "@/lib/stores/crawls";
import { addActivity } from "@/lib/stores/activity";

export const projectTools = {
  create_project: tool({
    description: "Create a new project to track in the Projects tab. MUST be called when building any app or project.",
    inputSchema: z.object({
      name: z.string().describe("Project name (e.g., 'Notes App', 'Blog')"),
      url: z.string().describe("Project URL — use http://localhost:PORT for local dev, or the deployed URL"),
      client: z.string().describe("Client or owner name (use 'Personal' for own projects)"),
      notes: z.string().optional().describe("Additional notes about the project"),
      localPath: z.string().optional().describe("Absolute path to the project directory on disk"),
    }),
    execute: async (data) => {
      const project = await createProject(data);
      await addActivity("project_created", `Created project "${project.name}" for ${project.client}`);
      return {
        message: `Created project "${project.name}" for ${project.client}`,
        project,
      };
    },
  }),

  list_projects: tool({
    description: "List all client projects with summary info.",
    inputSchema: z.object({}),
    execute: async () => {
      const projects = await listProjects();
      return {
        message: `${projects.length} project(s)`,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          url: p.url,
          audits: p.auditIds.length,
          crawls: p.crawlIds.length,
          createdAt: p.createdAt,
        })),
      };
    },
  }),

  resume_project: tool({
    description: "Resume working on an existing project. Loads the project details and scans the local directory to understand its current state (files, package.json, git status).",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Project ID to resume"),
      projectName: z.string().optional().describe("Project name to search for"),
    }),
    execute: async ({ projectId, projectName }) => {
      const allProjects = await listProjects();
      const project = projectId
        ? allProjects.find((p) => p.id === projectId)
        : projectName
          ? allProjects.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()))
          : undefined;

      if (!project) return { message: "Project not found. Use list_projects to see available projects." };

      const result: Record<string, unknown> = {
        message: `Resuming project: ${project.name}`,
        project,
      };

      // Scan the local directory if it exists
      if (project.localPath) {
        const { existsSync, readdirSync, readFileSync } = await import("node:fs");

        if (existsSync(project.localPath)) {
          // List top-level files
          const files = readdirSync(project.localPath, { withFileTypes: true })
            .filter((f) => !f.name.startsWith(".") && f.name !== "node_modules")
            .map((f) => ({ name: f.name, type: f.isDirectory() ? "dir" : "file" }));
          result.files = files;

          // Read package.json if it exists
          const pkgPath = `${project.localPath}/package.json`;
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
              result.packageJson = {
                name: pkg.name,
                scripts: pkg.scripts,
                dependencies: Object.keys(pkg.dependencies || {}),
                devDependencies: Object.keys(pkg.devDependencies || {}),
              };
            } catch { /* ignore */ }
          }

          // Check git status
          const { execute } = await import("@/lib/executor");
          const gitStatus = await execute("git", ["status", "--short"], { cwd: project.localPath });
          if (gitStatus.exitCode === 0) {
            result.gitStatus = gitStatus.stdout || "(clean)";
            const gitLog = await execute("git", ["log", "--oneline", "-5"], { cwd: project.localPath });
            result.recentCommits = gitLog.stdout;
          } else {
            result.git = "Not a git repository";
          }

          result.tip = `Project directory exists at ${project.localPath}. Use cwd="${project.localPath}" in your commands.`;
        } else {
          result.warning = `Local path ${project.localPath} not found. The project may have been moved or deleted.`;
        }
      }

      return result;
    },
  }),

  get_project: tool({
    description: "Get a project with all its associated audits and crawls.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID"),
    }),
    execute: async ({ projectId }) => {
      const project = await getProjectById(projectId);
      if (!project) return { message: `Project ${projectId} not found`, project: null };

      const audits = await getAudits(projectId);
      const crawls = await getCrawls(projectId);

      return {
        message: `Project: ${project.name}`,
        project,
        audits: audits.map((a) => ({
          id: a.id,
          url: a.url,
          scores: a.scores,
          timestamp: a.timestamp,
        })),
        crawls: crawls.map((c) => ({
          id: c.id,
          rootUrl: c.rootUrl,
          totalPages: c.totalPages,
          brokenLinks: c.brokenLinks.length,
          timestamp: c.timestamp,
        })),
      };
    },
  }),
};
