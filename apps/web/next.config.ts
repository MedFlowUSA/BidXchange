import type { NextConfig } from 'next';
import path from 'node:path';
const nextConfig: NextConfig = {
  logging: { incomingRequests: false },
  images: {
    localPatterns: [
      { pathname: '/brand/bidxchange-logo.png', search: '?v=2' },
      { pathname: '/brand/bidxchange-icon.png', search: '?v=2' },
    ],
  },
  turbopack: { root: path.resolve(__dirname, '../..') },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'bidxchange-beta.vercel.app' }],
        destination: 'https://bidxapp.vercel.app/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
