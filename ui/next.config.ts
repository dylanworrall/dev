import type { NextConfig } from "next";
import { webpack } from "next/dist/compiled/webpack/webpack";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify("2.3.0"),
      })
    );
    return config;
  },

  // WebContainer requires Cross-Origin Isolation headers (SharedArrayBuffer).
  // Scoped to /builder only — other routes stay unaffected.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
