import { build } from "esbuild";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiSrc = resolve(__dirname, "ui/src");

await build({
  entryPoints: ["ui/src/lib/ai/tools/index.ts"],
  bundle: true,
  outfile: "dist/tools.mjs",
  platform: "node",
  format: "esm",
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  external: ["playwright-core"],
  plugins: [{
    name: "alias-and-stub",
    setup(b) {
      // Resolve @/ imports
      b.onResolve({ filter: /^@\// }, (args) => {
        const rel = args.path.slice(2); // strip @/
        const base = join(uiSrc, rel);
        // Try .ts, .tsx, /index.ts
        for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          const full = base + ext;
          if (existsSync(full)) {
            // Stub convex files
            if (rel.includes("convex-server") || rel.includes("convex-api")) {
              return { path: full, namespace: "stub" };
            }
            return { path: full };
          }
        }
        // If file not found, check without extension (might already have it)
        if (existsSync(base)) return { path: base };
        // Stub missing files
        return { path: args.path, namespace: "stub" };
      });

      // Stub out convex/better-auth package imports
      b.onResolve({ filter: /^(convex|@convex-dev|better-auth)/ }, () => ({
        path: "stub", namespace: "stub",
      }));

      // Return no-op stubs
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `
          export function getConvexClient() { return null; }
          export function isConvexMode() { return false; }
          export const api = new Proxy({}, { get: () => new Proxy({}, { get: () => "" }) });
          export default {};
        `,
        loader: "ts",
      }));
    },
  }],
  tsconfig: "ui/tsconfig.json",
});

console.log("✓ Built dist/tools.mjs — 98 tools bundled");
