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
};

export default nextConfig;
