import type { NextConfig } from "next";

// NUR_BROWSER=1: statische Testversion für GitHub Pages (ohne Server-Routen und Passwortschutz).
const nurBrowser = process.env.NEXT_PUBLIC_NUR_BROWSER === "1";
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = nurBrowser
  ? {
      output: "export",
      basePath,
      // Server-Routen (route.ts) und proxy.ts werden nicht mitgebaut, nur .tsx-Seiten
      pageExtensions: ["tsx"],
      images: { unoptimized: true },
    }
  : {
      serverExternalPackages: ["@anthropic-ai/sdk"],
    };

export default nextConfig;
