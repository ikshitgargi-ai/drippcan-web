import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:5070 https://drippcan-tracker.onrender.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

// Same-origin proxy pattern: with NEXT_PUBLIC_API_BASE empty (.env.local),
// the browser calls /api/* on this origin and Next rewrites to the backend —
// localhost:5070 in dev, drippcan-tracker.onrender.com in prod.
const BACKEND =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:5070'
    : 'https://drippcan-tracker.onrender.com';

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      { source: '/healthz', destination: `${BACKEND}/healthz` },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
