import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  getSiteUrl,
  getProNetworxAppUrl,
  PUBLIC_MARKETING_PATHS,
  PUBLIC_PRO_NETWORX_PATHS,
} from '@/lib/site-url';

/**
 * Host-aware sitemap. Each domain advertises only its own canonical URLs so
 * Google Search Console properties for networxradio.com and pro-networx.com
 * each see a sitemap pointing at themselves.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host = (headerList.get('host') || '').toLowerCase();
  const isProNetworxHost = host.includes('pro-networx.com');
  const lastModified = new Date();

  if (isProNetworxHost) {
    const siteUrl = getProNetworxAppUrl();
    return PUBLIC_PRO_NETWORX_PATHS.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified,
      changeFrequency: path === '/pro-networx' ? 'weekly' : 'daily',
      priority: path === '/pro-networx' ? 1 : 0.8,
    }));
  }

  const siteUrl = getSiteUrl();
  return PUBLIC_MARKETING_PATHS.map((path) => ({
    url: path === '/' ? siteUrl : `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority:
      path === '/' ? 1 : path === '/features' || path === '/pricing' ? 0.9 : 0.7,
  }));
}
