/**
 * Starter template for WebContainer projects.
 * Vite + React 19 + Tailwind CSS v4 + shadcn/ui
 *
 * Includes pre-built shadcn components so the agent can use them immediately
 * without running `npx shadcn add`. Components are inlined to avoid CLI deps.
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
        clsx: "^2.1.1",
        "tailwind-merge": "^3.0.0",
        "class-variance-authority": "^0.7.1",
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
  resolve: {
    alias: { '@': '/src' },
  },
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
  --color-background: #050507;
  --color-foreground: #f5f5f7;
  --color-card: #0a0a0f;
  --color-card-foreground: #f5f5f7;
  --color-primary: #f97316;
  --color-primary-foreground: #ffffff;
  --color-secondary: #18181b;
  --color-secondary-foreground: #f5f5f7;
  --color-muted: #27272a;
  --color-muted-foreground: #a1a1aa;
  --color-accent: #f97316;
  --color-accent-foreground: #ffffff;
  --color-destructive: #ef4444;
  --color-border: #27272a;
  --color-input: #27272a;
  --color-ring: #f97316;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}`,

  // ── shadcn utilities ──
  "src/lib/utils.js": `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}`,

  // ── shadcn Button ──
  "src/components/ui/button.jsx": `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-border bg-transparent hover:bg-secondary text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

Button.displayName = "Button";
export { buttonVariants };`,

  // ── shadcn Input ──
  "src/components/ui/input.jsx": `import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}`,

  // ── shadcn Card ──
  "src/components/ui/card.jsx": `import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-6 text-card-foreground", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center pt-4", className)} {...props} />;
}`,

  // ── shadcn Badge ──
  "src/components/ui/badge.jsx": `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}`,

  // ── Starter App ──
  "src/App.jsx": `import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Rocket className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Your App</CardTitle>
          <CardDescription>
            This is your starter template with shadcn/ui components.
            Describe what you want to build and the AI agent will modify these files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">Get Started</Button>
        </CardContent>
      </Card>
    </div>
  );
}`,
};

/** Files the agent should NOT modify (infrastructure) */
export const LOCKED_FILES = new Set([
  "vite.config.js",
  "src/main.jsx",
  "src/lib/utils.js",
]);

/** Files to always include as context when sending to agent */
export const PREWARM_FILES = [
  "package.json",
  "src/App.jsx",
  "src/index.css",
  "src/components/ui/button.jsx",
  "src/components/ui/input.jsx",
  "src/components/ui/card.jsx",
  "src/components/ui/badge.jsx",
];
