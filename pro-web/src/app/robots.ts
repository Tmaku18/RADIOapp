import type { MetadataRoute } from 'next';

const SITE_URL = (
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com'
).replace(/\/$/, '');

/**
 * robots.txt — let search engines crawl the public marketing + directory
 * pages, but keep auth-gated app surfaces out of the index. Points crawlers
 * at the sitemap so new pages get discovered quickly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/signup',
          '/onboarding',
          '/home',
          '/search',
          '/discover',
          '/explore',
          '/messages',
          '/notifications',
          '/me',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
