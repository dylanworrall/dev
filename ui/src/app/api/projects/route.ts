import { NextResponse } from "next/server";
import { listProjects } from "@/lib/stores/projects";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET() {
  // Always include local projects (these are created by the agent)
  const localProjects = await listProjects();

  // Also fetch Convex projects if configured
  if (isConvexMode()) {
    try {
      const convex = getConvexClient()!;
      const convexProjects = await convex.query(api.projects.list, {});

      // Merge: convex projects get normalized IDs, local projects added if not duplicates
      const merged = (convexProjects as Array<Record<string, unknown>>).map((p) => ({
        id: (p._id || p.id) as string,
        name: p.name as string,
        url: p.url as string,
        client: p.client as string,
        notes: p.notes as string || "",
        localPath: p.localPath as string || undefined,
        auditIds: (p.auditIds || []) as string[],
        crawlIds: (p.crawlIds || []) as string[],
        createdAt: p.createdAt as string,
      }));

      // Add local projects that aren't already in Convex (by name)
      const convexNames = new Set(merged.map((p) => p.name.toLowerCase()));
      for (const lp of localProjects) {
        if (!convexNames.has(lp.name.toLowerCase())) {
          merged.push({
            id: lp.id,
            name: lp.name,
            url: lp.url,
            client: lp.client,
            notes: lp.notes,
            localPath: lp.localPath,
            auditIds: lp.auditIds,
            crawlIds: lp.crawlIds,
            createdAt: lp.createdAt,
          });
        }
      }

      return NextResponse.json(merged);
    } catch {
      // Convex failed, just return local
    }
  }

  return NextResponse.json(localProjects);
}
