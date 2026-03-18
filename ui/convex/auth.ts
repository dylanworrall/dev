import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.SITE_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-placeholder-secret-not-for-production-use",
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [convex({ authConfig })],
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
