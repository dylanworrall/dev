export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  // Builder is full-screen, no sidebar — bypasses AppShell auth gate
  return (
    <div className="fixed inset-0 z-10">
      {children}
    </div>
  );
}
