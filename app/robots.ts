import type { MetadataRoute } from "next";
import { absoluteSiteUrl, getSiteUrl } from "@/lib/site";

const PRIVATE_PATHS = [
  "/admin/",
  "/client/",
  "/api/",
  "/demo/operator-console",
  "/demo/client-dashboard",
  "/demo/walkthrough/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: getSiteUrl().origin,
  };
}
