import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Only initialize auth client when Convex is configured (production mode)
// In local mode, auth is not needed — avoids get-session 404 spam
const hasConvex = !!process.env.NEXT_PUBLIC_CONVEX_URL;

export const authClient = hasConvex
  ? createAuthClient({ plugins: [convexClient()] })
  : null;

const noop = () => {};
const noopAsync = async () => ({ data: null, error: null });
const useSessionStub = () => ({ data: null, isPending: false, error: null });

export const useSession = authClient?.useSession ?? useSessionStub;
export const signIn = authClient ? authClient.signIn : { email: noopAsync };
export const signUp = authClient ? authClient.signUp : { email: noopAsync };
export const signOut = authClient?.signOut ?? noopAsync;
