/**
 * Soshi Design System prompt — prepended to every builder agent prompt.
 * Kept SHORT and LAYOUT-FIRST so the agent doesn't ignore spacing rules.
 */
export const SOSHI_DESIGN_SYSTEM = `
## MANDATORY UI RULES — Read before writing ANY code

### PAGE STRUCTURE — Every app MUST use this exact wrapper:
\`\`\`jsx
<div className="min-h-screen bg-[#1C1C1E] text-white">
  <div className="max-w-2xl mx-auto px-6 py-10">
    {/* page content here */}
  </div>
</div>
\`\`\`
- Background is ALWAYS bg-[#1C1C1E] (NOT bg-black, NOT bg-white, NOT bg-gray-anything)
- Content is ALWAYS centered with max-w-2xl mx-auto px-6 py-10
- NEVER place content edge-to-edge without padding

### SPACING — Most common mistake. Follow exactly:
- Between page title and content: mb-8
- Between sections: space-y-6 or mb-8
- Between list items: space-y-3
- Card internal padding: p-5 (NEVER less than p-4)
- Grid gaps: gap-4 (NEVER gap-1 or gap-2 for cards)
- Title to subtitle: mb-1
- Input/button rows: gap-3

### COMPONENTS — Import from '@/components/ui'. NEVER write raw styled divs.
\`\`\`js
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, Toggle, Checkbox, Progress, Separator, Avatar, IconWell, Select, ListItem, ListItemContent, ListItemTitle, ListItemMeta, ListItemAction, EmptyState, StatCard } from '@/components/ui';
import { Plus, Trash2, Check, Search, Settings, Star, Clock, Inbox } from 'lucide-react';
\`\`\`

### GOLDEN EXAMPLE — A todo app built correctly. COPY THIS STRUCTURE:
\`\`\`jsx
import { useState } from 'react';
import { Page, PageHeader, Section, Button, Input, Checkbox, ListItem, ListItemContent, ListItemTitle, ListItemAction, EmptyState, StatCard, StatGrid } from '@/components/ui';
import { Plus, Trash2, Inbox } from 'lucide-react';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const addTodo = () => { if (!input.trim()) return; setTodos([...todos, { id: Date.now(), text: input, done: false }]); setInput(''); };
  const toggleTodo = (id) => setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTodo = (id) => setTodos(todos.filter(t => t.id !== id));
  const done = todos.filter(t => t.done).length;

  return (
    <Page>
      <PageHeader title="Tasks" subtitle={\`\${todos.length} tasks, \${done} completed\`} />

      <Section>
        <div className="flex gap-3">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTodo()} placeholder="Add a task..." className="flex-1" />
          <Button onClick={addTodo}><Plus size={16} /> Add</Button>
        </div>
      </Section>

      {todos.length > 0 && (
        <Section>
          <StatGrid>
            <StatCard value={todos.length} label="Total" color="#0A84FF" />
            <StatCard value={done} label="Done" color="#30D158" />
            <StatCard value={todos.length - done} label="Left" color="#FF9F0A" />
          </StatGrid>
        </Section>
      )}

      <div className="space-y-3">
        {todos.map(todo => (
          <ListItem key={todo.id}>
            <Checkbox checked={todo.done} onChange={() => toggleTodo(todo.id)} />
            <ListItemContent>
              <ListItemTitle className={todo.done ? 'line-through text-white/40' : ''}>{todo.text}</ListItemTitle>
            </ListItemContent>
            <ListItemAction>
              <button onClick={() => deleteTodo(todo.id)} className="text-white/20 hover:text-[#FF453A] transition-colors"><Trash2 size={16} /></button>
            </ListItemAction>
          </ListItem>
        ))}
      </div>

      {todos.length === 0 && <EmptyState icon={<Inbox size={24} className="text-[#0A84FF]" />} title="No tasks yet" description="Add your first task above" />}
    </Page>
  );
}
\`\`\`

### KEY LAYOUT COMPONENTS — Use these to avoid spacing mistakes:
- \`<Page>\` — wraps entire app with bg-[#1C1C1E], max-w-2xl, px-6 py-10. Use \`wide\` prop for max-w-3xl.
- \`<PageHeader title="..." subtitle="...">\` — auto mb-8 spacing below
- \`<Section>\` — wraps any block with mb-8 bottom margin
- \`<StatGrid>\` — wraps StatCards in grid-cols-3 gap-4 automatically

### STRICT RULES:
1. bg-[#1C1C1E] page background — NEVER use bg-black, bg-white, bg-gray-*, bg-zinc-*, bg-slate-*
2. Cards are bg-[#2A2A2C] — they contrast against the #1C1C1E background
3. Inputs are bg-[#1C1C1E] with border-white/5 — they sit inside cards
4. NEVER use Tailwind named colors (bg-blue-500, text-gray-400). ONLY use [#hex] syntax.
5. ALWAYS use the pre-built components. Never write raw <button>, <input>, or card-like <div>s.
6. gap-4 minimum between cards/grid items. space-y-3 for list items.
7. Font sizes: text-[15px] body, text-[14px] labels, text-[13px] descriptions, text-[12px] meta, text-[11px] timestamps
8. Every interactive element needs transition-colors
`;
