import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
  throw new Error("This build requires one persistent Node host. Use the Docker deployment in docs/deployment.md; serverless filesystem and process-local events are not supported.");
}
const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
