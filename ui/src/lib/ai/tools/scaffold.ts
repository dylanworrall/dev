import { tool } from "ai";
import { z } from "zod";
import { executeShell } from "@/lib/executor";
import { getWorkspaceRoot } from "@/lib/workspace";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const scaffoldTools = {
  scaffold_project: tool({
    description: "Scaffold a new project with proper setup. Handles all the common pitfalls (interactive prompts, Windows issues, etc.). Use this instead of manually running create-next-app or create-vite.",
    inputSchema: z.object({
      name: z.string().describe("Project directory name (e.g., 'my-portfolio')"),
      template: z.enum([
        "nextjs",          // Next.js + TypeScript + Tailwind + App Router
        "nextjs-shadcn",   // Next.js + TypeScript + Tailwind + shadcn/ui (recommended)
        "vite-react",      // Vite + React + TypeScript
        "vite-react-tailwind", // Vite + React + TypeScript + Tailwind
        "html",            // Plain HTML/CSS/JS
      ]).describe("Project template"),
      extras: z.array(z.string()).optional().describe("Additional npm packages to install (e.g., ['framer-motion', 'date-fns'])"),
    }),
    execute: async ({ name, template, extras }) => {
      const root = getWorkspaceRoot();
      const projectDir = join(root, name);

      if (existsSync(projectDir)) {
        return {
          message: `Directory "${name}" already exists at ${projectDir}. Use a different name or resume the existing project.`,
          path: projectDir,
          exists: true,
        };
      }

      mkdirSync(projectDir, { recursive: true });
      const steps: string[] = [];
      const errors: string[] = [];

      try {
        if (template === "nextjs" || template === "nextjs-shadcn") {
          // Create Next.js app — use --yes to skip all prompts
          const create = await executeShell(
            `npx create-next-app@latest "${projectDir}" --typescript --tailwind --eslint --app --no-src-dir --no-import-alias --yes`,
            { cwd: root, timeout: 120_000 }
          );
          if (create.exitCode !== 0) {
            errors.push(`create-next-app failed: ${create.stderr.slice(-500)}`);
            // Fallback: manual setup
            const fallback = await executeShell(
              `npm init -y && npm install next@latest react@latest react-dom@latest typescript @types/react @types/react-dom @tailwindcss/postcss tailwindcss postcss`,
              { cwd: projectDir, timeout: 120_000 }
            );
            if (fallback.exitCode !== 0) {
              return { message: `Project scaffold failed: ${fallback.stderr.slice(-300)}`, errors };
            }
            steps.push("Manual Next.js setup (fallback)");
          } else {
            steps.push("Next.js project created");
          }

          // Ensure @tailwindcss/postcss is installed (Tailwind v4 requires it)
          await executeShell(`npm install -D @tailwindcss/postcss`, { cwd: projectDir, timeout: 60_000 });

          // Fix postcss.config if it uses tailwindcss directly (v4 breaking change)
          const postcssPath = join(projectDir, "postcss.config.mjs");
          const { existsSync: postcssExists, readFileSync: readPostcss, writeFileSync: writePostcss } = await import("node:fs");
          if (postcssExists(postcssPath)) {
            const postcssContent = readPostcss(postcssPath, "utf-8");
            if (postcssContent.includes("tailwindcss") && !postcssContent.includes("@tailwindcss/postcss")) {
              writePostcss(postcssPath, postcssContent.replace(/tailwindcss/g, "@tailwindcss/postcss"), "utf-8");
              steps.push("Fixed postcss.config for Tailwind v4");
            }
          }

          // Add shadcn if requested
          if (template === "nextjs-shadcn") {
            // Install shadcn dependencies manually first (prevents missing module errors)
            await executeShell(
              `npm install class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot`,
              { cwd: projectDir, timeout: 60_000 }
            );
            await executeShell(
              `npm install -D tailwindcss-animate`,
              { cwd: projectDir, timeout: 60_000 }
            );
            steps.push("shadcn dependencies installed");

            // Create lib/utils.ts (shadcn's cn helper)
            const libDir = join(projectDir, "lib");
            if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true });
            const { writeFileSync } = await import("node:fs");
            writeFileSync(join(libDir, "utils.ts"),
              `import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n`
            );
            steps.push("Created lib/utils.ts");

            // Try shadcn init
            const shadcn = await executeShell(
              `npx shadcn@latest init -d -y`,
              { cwd: projectDir, timeout: 60_000 }
            );
            if (shadcn.exitCode === 0) {
              steps.push("shadcn/ui initialized");
            }

            // Add common components
            const addComponents = await executeShell(
              `npx shadcn@latest add button card input textarea badge separator -y`,
              { cwd: projectDir, timeout: 60_000 }
            );
            if (addComponents.exitCode === 0) {
              steps.push("shadcn components added");
            }
          }

        } else if (template === "vite-react" || template === "vite-react-tailwind") {
          const create = await executeShell(
            `npm create vite@latest "${name}" -- --template react-ts`,
            { cwd: root, timeout: 60_000 }
          );
          if (create.exitCode !== 0) {
            errors.push(`create-vite failed: ${create.stderr.slice(-300)}`);
            return { message: `Vite scaffold failed`, errors };
          }
          steps.push("Vite + React + TypeScript created");

          // Install deps
          const install = await executeShell(`npm install`, { cwd: projectDir, timeout: 120_000 });
          if (install.exitCode === 0) steps.push("Dependencies installed");

          if (template === "vite-react-tailwind") {
            const tw = await executeShell(
              `npm install -D tailwindcss @tailwindcss/vite`,
              { cwd: projectDir, timeout: 60_000 }
            );
            if (tw.exitCode === 0) steps.push("Tailwind CSS installed");
          }

        } else if (template === "html") {
          // Plain HTML project
          const { writeFileSync } = await import("node:fs");
          writeFileSync(join(projectDir, "index.html"), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script src="script.js"></script>
</body>
</html>`);
          writeFileSync(join(projectDir, "style.css"), `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; min-height: 100vh; }
`);
          writeFileSync(join(projectDir, "script.js"), `// ${name}\nconsole.log("Ready");\n`);
          steps.push("HTML/CSS/JS project created");
        }

        // Install extras
        if (extras && extras.length > 0) {
          const install = await executeShell(
            `npm install ${extras.join(" ")}`,
            { cwd: projectDir, timeout: 120_000 }
          );
          if (install.exitCode === 0) {
            steps.push(`Installed: ${extras.join(", ")}`);
          } else {
            errors.push(`Some extras failed: ${install.stderr.slice(-200)}`);
          }
        }

        return {
          message: `Project "${name}" scaffolded successfully`,
          path: projectDir,
          template,
          steps,
          errors: errors.length > 0 ? errors : undefined,
          tip: `Use cwd="${name}" in your commands. Start the dev server with start_server("npm run dev", cwd="${name}").`,
        };
      } catch (e: unknown) {
        return { message: `Scaffold error: ${(e as Error).message}`, errors };
      }
    },
  }),
};
