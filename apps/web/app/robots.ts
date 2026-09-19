import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/assistant',
        '/api/',
        '/opportunities',
        '/pursuits',
        '/company',
        '/documents',
        '/reports',
        '/settings',
        '/login',
        '/auth/',
        '/*?*',
      ],
    },
    sitemap: 'https://bidxapp.vercel.app/sitemap.xml',
  };
}
