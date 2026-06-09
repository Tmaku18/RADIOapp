import type { MetadataRoute } from 'next';
import { getSiteUrl, PUBLIC_MARKETING_PATHS } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return PUBLIC_MARKETING_PATHS.map((path) => ({
    url: path === '/' ? siteUrl : `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/features' || path === '/pricing' ? 0.9 : 0.7,
  }));
}
