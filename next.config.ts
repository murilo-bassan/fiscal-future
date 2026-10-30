import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Há outro package-lock.json acima desta pasta; fixa a raiz do projeto.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
