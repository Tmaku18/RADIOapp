import type { MetadataRoute } from 'next';

const SITE_URL = (
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com'
).replace(/\/$/, '');

/**
 * sitemap.xml — the public, indexable pages of PRO‑NETWORX. Submit this in
 * Google Search Console (Sitemaps → add `sitemap.xml`) so Google crawls and
 * indexes the brand pages. Add public profile/service URLs here later if you
 * want them indexed too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/directory', priority: 0.9, changeFrequency: 'daily' },
    { path: '/pro-directory', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
