import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (for example an automated browser test) can use its own build folder
  // with NEXT_DIST_DIR=.next-test, so it never touches the one you are running.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
