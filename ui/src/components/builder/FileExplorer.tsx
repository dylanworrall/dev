"use client";

import { useState, useEffect, useCallback } from "react";
import { File, Folder, FolderOpen, RefreshCw } from "lucide-react";
import type { WebContainer } from "@webcontainer/api";

interface FileExplorerProps {
  wc: WebContainer | null;
  onFileSelect?: (path: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export function FileExplorer({ wc, onFileSelect }: FileExplorerProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));

  const loadDir = useCallback(async (path: string): Promise<FileNode[]> => {
    if (!wc) return [];
    try {
      const entries = await wc.fs.readdir(path, { withFileTypes: true });
      const nodes: FileNode[] = [];
      for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        nodes.push({
          name: entry.name,
          path: entryPath,
          isDir: entry.isDirectory(),
        });
      }
      return nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }, [wc]);

  const refresh = useCallback(async () => {
    const root = await loadDir("");
    setTree(root);
  }, [loadDir]);

  useEffect(() => {
    if (wc) refresh();
  }, [wc, refresh]);

  const toggleDir = async (node: FileNode) => {
    const next = new Set(expanded);
    if (next.has(node.path)) {
      next.delete(node.path);
    } else {
      next.add(node.path);
      if (!node.children) {
        node.children = await loadDir(node.path);
        setTree([...tree]); // trigger re-render
      }
    }
    setExpanded(next);
  };

  const renderNode = (node: FileNode, depth: number) => {
    const isOpen = expanded.has(node.path);
    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => node.isDir ? toggleDir(node) : onFileSelect?.(node.path)}
          className="flex items-center gap-1.5 w-full px-2 py-0.5 text-xs hover:bg-surface-2 rounded transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.isDir ? (
            isOpen ? <FolderOpen className="size-3.5 text-accent flex-shrink-0" /> : <Folder className="size-3.5 text-accent/60 flex-shrink-0" />
          ) : (
            <File className="size-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="truncate text-foreground/80">{node.name}</span>
        </button>
        {node.isDir && isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (!wc) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Waiting for WebContainer...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Files</span>
        <button
          type="button"
          onClick={refresh}
          className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No files yet</div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
