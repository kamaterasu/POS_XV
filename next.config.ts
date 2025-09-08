// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kaaszzouxgbyusxbobdx.supabase.co', // ← яг өөрийн host
        pathname: '/storage/v1/object/**',
      },
    ],
    // SVG зураг алсаас үзүүлэх бол (итгэмжтэй эх сурвалж үед л асаа)
    // dangerouslyAllowSVG: true,
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
