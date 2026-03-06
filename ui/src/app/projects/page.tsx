"use client";

import { useEffect, useState } from "react";
import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  url: string;
  client: string;
  auditIds: string[];
  crawlIds: string[];
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <FolderKanbanIcon className="size-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground">Manage client projects</p>
          </div>
        </div>
        <Button size="sm">
          <PlusIcon className="size-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            Use the chat to create a project: &quot;Create a project for example.com&quot;
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              client={project.client}
              url={project.url}
              auditCount={project.auditIds.length}
              crawlCount={project.crawlIds.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
