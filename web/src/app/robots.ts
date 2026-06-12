import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  getSiteUrl,
  getProNetworxAppUrl,
  NOINDEX_PATH_PREFIXES,
  NOINDEX_PRO_NETWORX_SUBPATHS,
} from '@/lib/site-url';

/**
 * Host-aware robots.txt. The same Next.js app serves both networxradio.com
 * and pro-networx.com (the latter via middleware-routed `/pro-networx/*`),
 * so robots needs to advertise the right rules per domain:
 *
 * - networxradio.com: hide auth surfaces and the /pro-networx tree (those
 *   paths 308-redirect to pro-networx.com anyway).
 * - pro-networx.com: allow the public /pro-networx and /pro-networx/directory
 *   pages so Google can index them; keep auth-gated subroutes out.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const host = (headerList.get('host') || '').toLowerCase();
  const isProNetworxHost = host.includes('pro-networx.com');

  if (isProNetworxHost) {
    const siteUrl = getProNetworxAppUrl();
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: [...NOINDEX_PRO_NETWORX_SUBPATHS],
      },
      sitemap: `${siteUrl}/sitemap.xml`,
      host: siteUrl,
    };
  }

  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...NOINDEX_PATH_PREFIXES,
        '/pro-networx',
        '/pro-networx/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
