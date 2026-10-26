import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { INDEXABLE_ROUTES } from "@/lib/seo-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((r) => ({
    url: absoluteUrl(r.path),
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
