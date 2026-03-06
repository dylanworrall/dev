import { tool } from "ai";
import { z } from "zod";
import { createDeployment, listDeployments, getDeploymentById, updateDeployment, addDeployLog } from "@/lib/stores/deployments";
import { addActivity } from "@/lib/stores/activity";

export const deploymentTools = {
  list_deployments: tool({
    description: "List deployments, optionally filtered by project, environment, or status.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Filter by project ID"),
      environment: z.enum(["production", "staging", "preview", "dev"]).optional(),
      status: z.enum(["building", "deploying", "live", "failed", "rolled-back"]).optional(),
    }),
    execute: async (filter) => {
      const deployments = await listDeployments(filter);
      return {
        message: `${deployments.length} deployment(s)`,
        deployments: deployments.map((d) => ({
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
    description: "Get full details of a deployment including logs.",
    inputSchema: z.object({
      deploymentId: z.string().describe("The deployment ID"),
    }),
    execute: async ({ deploymentId }) => {
      const deployment = await getDeploymentById(deploymentId);
      if (!deployment) return { message: "Deployment not found", deployment: null };
      return { message: `Deployment: ${deployment.environment} (${deployment.status})`, deployment };
    },
  }),

  trigger_deploy: tool({
    description: "Trigger a new deployment. Requires user approval.",
    inputSchema: z.object({
      projectId: z.string().describe("Project ID to deploy"),
      environment: z.enum(["production", "staging", "preview", "dev"]).describe("Target environment"),
      commitSha: z.string().describe("Commit SHA to deploy"),
      branch: z.string().describe("Branch name"),
      url: z.string().optional().describe("Deployment URL"),
    }),
    execute: async (data) => {
      const deployment = await createDeployment(data);
      // Simulate build completing
      setTimeout(async () => {
        await addDeployLog(deployment.id, "Dependencies installed");
        await addDeployLog(deployment.id, "Build completed");
        await updateDeployment(deployment.id, { status: "live", buildDuration: Math.floor(Math.random() * 60) + 15 });
      }, 2000);
      await addActivity("project_created", `Deployed to ${data.environment} from ${data.branch}`);
      return { message: `Deployment triggered for ${data.environment}`, deployment };
    },
  }),

  get_deploy_logs: tool({
    description: "Get build/deploy logs for a deployment.",
    inputSchema: z.object({
      deploymentId: z.string().describe("The deployment ID"),
    }),
    execute: async ({ deploymentId }) => {
      const deployment = await getDeploymentById(deploymentId);
      if (!deployment) return { message: "Deployment not found", logs: [] };
      return { message: `Logs for deployment ${deploymentId.slice(0, 8)}`, logs: deployment.logs };
    },
  }),

  rollback: tool({
    description: "Rollback a deployment. Requires user approval.",
    inputSchema: z.object({
      deploymentId: z.string().describe("The deployment ID to roll back"),
    }),
    execute: async ({ deploymentId }) => {
      const deployment = await updateDeployment(deploymentId, { status: "rolled-back" });
      if (!deployment) return { message: "Deployment not found" };
      await addDeployLog(deploymentId, "Deployment rolled back");
      await addActivity("project_created", `Rolled back deployment ${deploymentId.slice(0, 8)}`);
      return { message: `Rolled back deployment ${deploymentId.slice(0, 8)}` };
    },
  }),
};
