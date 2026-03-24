/**
 * Starter template for WebContainer projects.
 * Vite + React 19 + Tailwind CSS v4 — matches our design system.
 *
 * Modeled after Chef's template/ directory:
 * - Pre-defined files that the agent can modify
 * - Dev server starts immediately after npm install
 * - Locked files the agent shouldn't touch (vite.config, main.jsx)
 */

export const TEMPLATE_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "dev-project",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^0.468.0",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.5.0",
        vite: "^6.0.0",
        tailwindcss: "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
      },
    },
    null,
    2
  ),

  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dev Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

  "vite.config.js": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});`,

  "src/main.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  "src/index.css": `@import "tailwindcss";

@theme inline {
  --color-surface-0: #050507;
  --color-surface-1: #0a0a0f;
  --color-surface-2: #141419;
  --color-accent: #f97316;
  --color-accent-green: #22c55e;
  --color-accent-red: #ef4444;
}`,

  "src/App.jsx": `import { Rocket } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-surface-0 text-white flex items-center justify-center font-[system-ui]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
          <Rocket className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Your App</h1>
        <p className="text-zinc-400 max-w-md">
          This is your starter template. Describe what you want to build
          and the AI agent will modify these files.
        </p>
      </div>
    </div>
  );
}`,
};

/** Files the agent should NOT modify (infrastructure) */
export const LOCKED_FILES = new Set([
  "vite.config.js",
  "src/main.jsx",
]);

/** Files to always include as context when sending to agent */
export const PREWARM_FILES = [
  "package.json",
  "src/App.jsx",
  "src/index.css",
];
