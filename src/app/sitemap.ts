import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories, getCollections } from "@/lib/data/catalog";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections] = await Promise.all([getAllProductSlugs(), getCategories(), getCollections()]);
  const fixed = ["", "/shop", "/collections", "/about", "/contact", "/privacy-policy", "/terms", "/shipping-policy", "/cancellation-policy"];
  return [
    ...fixed.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: `${siteUrl}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ url: `${siteUrl}/collections/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${siteUrl}/shop/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
