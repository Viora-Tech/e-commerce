import type { NextConfig } from 'next'

const config: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    '@commerce/db',
    '@commerce/core',
    '@commerce/config',
    '@commerce/api',
    '@commerce/auth',
    '@commerce/ui',
    '@commerce/storage',
  ],
  serverExternalPackages: ['postgres'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
            },
          ]
        : []),
    ],
  },
}

export default config
