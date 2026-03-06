import { tool } from "ai";
import { z } from "zod";
import { createProject, listProjects, getProjectById } from "@/lib/stores/projects";
import { getAudits } from "@/lib/stores/audits";
import { getCrawls } from "@/lib/stores/crawls";
import { addActivity } from "@/lib/stores/activity";

export const projectTools = {
  create_project: tool({
    description: "Create a new client project to track audits, crawls, and work for a specific client.",
    inputSchema: z.object({
      name: z.string().describe("Project name"),
      url: z.string().url().describe("Client's website URL"),
      client: z.string().describe("Client name or company"),
      notes: z.string().optional().describe("Additional notes about the project"),
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
