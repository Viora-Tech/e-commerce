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
  ],
  serverExternalPackages: ['postgres'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }] },
}

export default config
