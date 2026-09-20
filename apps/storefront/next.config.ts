import type { NextConfig } from 'next'

const config: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@commerce/db', '@commerce/core', '@commerce/config', '@commerce/blocks'],
  serverExternalPackages: ['postgres'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }] },
}

export default config
