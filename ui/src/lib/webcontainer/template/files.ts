/**
 * Starter template for WebContainer projects.
 * Vite + React 19 + Tailwind CSS v4 + Soshi Design System
 *
 * Full component library pre-installed. Agent should ALWAYS use these
 * components — never write raw HTML with custom styles.
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
        motion: "^12.0.0",
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
<html lang="en" class="dark">
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

body {
  background: #000000;
  color: #FFFFFF;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::selection { background: #0A84FF; color: #fff; }`,

  "src/lib/utils.js": `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}`,

  // CLAUDE.md — Claude Code reads this automatically as top-priority instructions
  "CLAUDE.md": `# Soshi Design System — MANDATORY

## USE LAYOUT COMPONENTS — They handle spacing automatically:
- <Page> — wraps ENTIRE app (bg, padding, centering). Use instead of manual divs.
- <PageHeader title="..." subtitle="..."> — page title with mb-8 below.
- <Section> — wraps EACH content block with mb-8 spacing.
- <StatGrid> — wraps <StatCard>s in 3-column grid.

## CORRECT APP STRUCTURE:
\`\`\`
<Page>
  <PageHeader title="..." subtitle="..." />
  <Section> input row here </Section>
  <Section> stats here </Section>
  <div className="space-y-3"> list items here </div>
</Page>
\`\`\`

## Import ALL from '@/components/ui':
Page, PageHeader, Section, Button, Input, Card, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Dialog, Toggle, Checkbox, Progress, Separator, Avatar, IconWell, Select, ListItem, ListItemContent, ListItemTitle, ListItemMeta, ListItemAction, EmptyState, StatCard, StatGrid

## Colors (ONLY these hex values):
Page bg-[#1C1C1E] | Cards bg-[#2A2A2C] | Hover bg-[#3A3A3C] | Blue #0A84FF | Green #30D158 | Red #FF453A
NEVER use bg-black, bg-white, bg-gray-*, bg-zinc-*, text-gray-*. ONLY [#hex] syntax.

## Spacing: <Section> handles it. Also: space-y-3 for lists, gap-3 for input+button rows.
`,

  // ════════════════════════════════════════════════════════════════
  // FULL SOSHI COMPONENT LIBRARY
  // ════════════════════════════════════════════════════════════════

  "src/components/ui/button.jsx": `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#0A84FF] text-white hover:bg-blue-500 shadow-sm rounded-lg text-sm",
        destructive: "bg-[#FF453A] text-white hover:bg-[#FF453A]/80 shadow-sm shadow-[#FF453A]/20 rounded-lg text-sm",
        outline: "border border-white/5 bg-[#2A2A2C] hover:bg-[#3A3A3C] text-white shadow-sm rounded-lg text-sm",
        secondary: "bg-[#2A2A2C] text-white/90 hover:bg-[#3A3A3C] border border-white/5 shadow-sm rounded-lg text-sm",
        ghost: "hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm",
        link: "text-[#0A84FF] underline-offset-4 hover:underline text-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
export { buttonVariants };`,

  "src/components/ui/input.jsx": `import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "w-full bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/30",
        className
      )}
      {...props}
    />
  );
}`,

  "src/components/ui/textarea.jsx": `import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "w-full bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/30 min-h-[80px] resize-none",
        className
      )}
      {...props}
    />
  );
}`,

  "src/components/ui/card.jsx": `import { cn } from "@/lib/utils";

export function Card({ className, interactive, ...props }) {
  return (
    <div
      className={cn(
        "bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm",
        interactive && "group hover:bg-[#3A3A3C] transition-colors cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1 mb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-[14px] font-semibold text-white/90", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-[13px] font-medium text-white/50", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center mt-3 pt-3 border-t border-white/5", className)} {...props} />;
}`,

  "src/components/ui/badge.jsx": `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#0A84FF]/10 text-[#0A84FF]",
        secondary: "bg-[#2A2A2C] text-white/70 border border-white/5",
        destructive: "bg-[#FF453A]/10 text-[#FF453A]",
        success: "bg-[#30D158]/10 text-[#30D158]",
        warning: "bg-[#FF9F0A]/10 text-[#FF9F0A]",
        purple: "bg-[#BF5AF2]/10 text-[#BF5AF2]",
        outline: "border border-white/5 text-white/70",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}`,

  "src/components/ui/tabs.jsx": `import { createContext, useContext, useState } from 'react';
import { cn } from "@/lib/utils";

const TabsContext = createContext({ value: '', onChange: () => {} });

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className }) {
  const [internal, setInternal] = useState(defaultValue || '');
  const value = controlledValue !== undefined ? controlledValue : internal;
  const onChange = onValueChange || setInternal;
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={cn("", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }) {
  return (
    <div className={cn("bg-[#2A2A2C] p-1 rounded-lg flex gap-1 border border-white/5 w-fit", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }) {
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.onChange(value)}
      className={cn(
        "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
        active ? "bg-[#3A3A3C] text-white shadow-sm" : "text-white/50 hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}`,

  "src/components/ui/dialog.jsx": `import { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { X } from 'lucide-react';

export function Dialog({ open, onClose, children }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, children, onClose }) {
  return (
    <div className={cn("flex items-center justify-between px-5 pt-5 pb-3", className)}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn("text-[14px] font-semibold text-white/90", className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn("text-[13px] font-medium text-white/50 mt-1", className)} {...props} />;
}

export function DialogContent({ className, ...props }) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn("flex items-center justify-end gap-2 px-5 pb-5 pt-2", className)} {...props} />;
}`,

  "src/components/ui/toggle.jsx": `export function Toggle({ enabled, onToggle, ...props }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={\`w-10 h-6 rounded-full transition-colors relative \${enabled ? 'bg-[#0A84FF]' : 'bg-white/10'}\`}
      {...props}
    >
      <div className={\`w-[18px] h-[18px] rounded-full bg-white shadow-sm absolute top-[3px] transition-transform \${enabled ? 'translate-x-[19px]' : 'translate-x-[3px]'}\`} />
    </button>
  );
}`,

  "src/components/ui/checkbox.jsx": `import { Check } from 'lucide-react';
import { cn } from "@/lib/utils";

export function Checkbox({ checked, onChange, className }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className={cn(
        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0",
        checked
          ? "bg-[#0A84FF] border-[#0A84FF] text-white"
          : "border-white/20 hover:border-white/40 text-transparent",
        className
      )}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}`,

  "src/components/ui/progress.jsx": `import { cn } from "@/lib/utils";

export function Progress({ value = 0, color = "#0A84FF", className }) {
  return (
    <div className={cn("w-full h-2 rounded-full bg-white/5 overflow-hidden", className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: \`\${Math.min(100, Math.max(0, value))}%\`, backgroundColor: color }}
      />
    </div>
  );
}`,

  "src/components/ui/separator.jsx": `import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal" }) {
  return (
    <div className={cn(
      orientation === "horizontal" ? "h-px w-full bg-white/5" : "w-px h-full bg-white/5",
      className
    )} />
  );
}`,

  "src/components/ui/avatar.jsx": `import { cn } from "@/lib/utils";

export function Avatar({ src, fallback, size = "default", className }) {
  const sizes = { sm: "w-8 h-8 text-[12px]", default: "w-10 h-10 text-[14px]", lg: "w-12 h-12 text-[16px]" };
  if (src) {
    return <img src={src} className={cn(sizes[size], "rounded-full object-cover", className)} />;
  }
  return (
    <div className={cn(sizes[size], "rounded-full bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] flex items-center justify-center font-semibold text-white", className)}>
      {fallback || "?"}
    </div>
  );
}`,

  "src/components/ui/icon-well.jsx": `import { cn } from "@/lib/utils";

export function IconWell({ className, color = "#0A84FF", children, size = "default" }) {
  const sizes = { sm: "w-8 h-8 rounded-lg", default: "w-10 h-10 rounded-xl", lg: "w-12 h-12 rounded-2xl" };
  return (
    <div
      className={cn(sizes[size] || sizes.default, "flex items-center justify-center flex-shrink-0", className)}
      style={{ backgroundColor: color + "1a", color }}
    >
      {children}
    </div>
  );
}`,

  "src/components/ui/select.jsx": `import { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from 'lucide-react';

export function Select({ value, onValueChange, options = [], placeholder = "Select...", className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors flex items-center justify-between"
      >
        <span className={selected ? "text-white" : "text-white/30"}>{selected?.label || placeholder}</span>
        <ChevronDown size={14} className={\`text-white/40 transition-transform \${open ? "rotate-180" : ""}\`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl overflow-hidden py-1">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onValueChange(opt.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#3A3A3C] transition-colors flex items-center justify-between"
            >
              <span className={value === opt.value ? "text-[#0A84FF]" : "text-white/90"}>{opt.label}</span>
              {value === opt.value && <Check size={14} className="text-[#0A84FF]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}`,

  "src/components/ui/list-item.jsx": `import { cn } from "@/lib/utils";

export function ListItem({ className, children, ...props }) {
  return (
    <div className={cn("group flex items-center gap-4 p-4 rounded-xl bg-[#2A2A2C] border border-white/[0.08] shadow-sm hover:bg-[#3A3A3C] transition-colors", className)} {...props}>
      {children}
    </div>
  );
}

export function ListItemContent({ className, ...props }) {
  return <div className={cn("flex-1 min-w-0", className)} {...props} />;
}

export function ListItemTitle({ className, ...props }) {
  return <h3 className={cn("text-[15px] font-medium text-white/90", className)} {...props} />;
}

export function ListItemMeta({ className, ...props }) {
  return <p className={cn("text-[12px] font-medium text-white/40 mt-1", className)} {...props} />;
}

export function ListItemAction({ className, ...props }) {
  return <div className={cn("opacity-0 group-hover:opacity-100 transition-all", className)} {...props} />;
}`,

  "src/components/ui/empty-state.jsx": `export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-16">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/10 flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-white/50 mb-1">{title}</p>
      {description && <p className="text-[13px] font-medium text-white/35">{description}</p>}
    </div>
  );
}`,

  "src/components/ui/stat-card.jsx": `import { cn } from "@/lib/utils";

export function StatCard({ value, label, color = "#0A84FF", className }) {
  return (
    <div className={cn("bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm text-center", className)}>
      <p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[11px] text-white/35 font-medium uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

/** Wraps StatCards in a 3-column grid. Just put <StatCard>s inside. */
export function StatGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {children}
    </div>
  );
}`,

  "src/components/ui/page.jsx": `import { cn } from "@/lib/utils";

/** Page wrapper — enforces correct background, centering, and padding. */
export function Page({ children, className, wide }) {
  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">
      <div className={cn(wide ? "max-w-3xl" : "max-w-2xl", "mx-auto px-6 py-10", className)}>
        {children}
      </div>
    </div>
  );
}

/** Page header with title, subtitle, and optional action button. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex justify-between items-start mb-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        {subtitle && <p className="text-[13px] font-medium text-white/50">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Section with automatic bottom margin. */
export function Section({ children, className }) {
  return <div className={cn("mb-8", className)}>{children}</div>;
}`,

  "src/components/ui/index.js": `// Re-export all components for easy imports
export { Button } from './button';
export { Input } from './input';
export { Textarea } from './textarea';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { Badge } from './badge';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './dialog';
export { Toggle } from './toggle';
export { Checkbox } from './checkbox';
export { Progress } from './progress';
export { Separator } from './separator';
export { Avatar } from './avatar';
export { IconWell } from './icon-well';
export { Select } from './select';
export { ListItem, ListItemContent, ListItemTitle, ListItemMeta, ListItemAction } from './list-item';
export { EmptyState } from './empty-state';
export { StatCard, StatGrid } from './stat-card';
export { Page, PageHeader, Section } from './page';`,

  // ── Starter App ──
  "src/App.jsx": `import { Rocket } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/10 flex items-center justify-center mx-auto mb-4">
            <Rocket size={24} className="text-[#0A84FF]" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Your App</h1>
          <p className="text-[13px] font-medium text-white/50">
            Describe what you want to build and the AI will generate it.
          </p>
        </div>
        <Card className="text-center">
          <CardContent>
            <Button className="w-full">Get Started</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}`,
};

/** Files the agent should NOT modify (infrastructure) */
export const LOCKED_FILES = new Set([
  "vite.config.js",
  "src/main.jsx",
  "src/lib/utils.js",
  "src/components/ui/index.js",
  "CLAUDE.md",
]);

/** Files to always include as context when sending to agent */
export const PREWARM_FILES = [
  "package.json",
  "src/App.jsx",
  "src/index.css",
  "src/components/ui/index.js",
  "src/components/ui/button.jsx",
  "src/components/ui/input.jsx",
  "src/components/ui/textarea.jsx",
  "src/components/ui/card.jsx",
  "src/components/ui/badge.jsx",
  "src/components/ui/tabs.jsx",
  "src/components/ui/dialog.jsx",
  "src/components/ui/toggle.jsx",
  "src/components/ui/checkbox.jsx",
  "src/components/ui/progress.jsx",
  "src/components/ui/separator.jsx",
  "src/components/ui/avatar.jsx",
  "src/components/ui/icon-well.jsx",
  "src/components/ui/select.jsx",
  "src/components/ui/list-item.jsx",
  "src/components/ui/empty-state.jsx",
  "src/components/ui/stat-card.jsx",
  "src/components/ui/page.jsx",
];
