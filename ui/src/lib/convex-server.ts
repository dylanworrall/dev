import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  if (!client) client = new ConvexHttpClient(url);
  return client;
}

export function isConvexMode(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}
