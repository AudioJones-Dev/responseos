import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site";

const ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/audit", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/industries/home-services", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/industries/contractors", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/trust", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/demo", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/industries/med-spas", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: absoluteSiteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
