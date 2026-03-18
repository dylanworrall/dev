"use client";

import { type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient as authClientOrNull } from "@/lib/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexProvider({ children }: { children: ReactNode }) {
  if (!convex || !authClientOrNull) return <>{children}</>;
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClientOrNull}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
