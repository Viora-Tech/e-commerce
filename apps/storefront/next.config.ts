import type { NextConfig } from 'next'

const config: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@commerce/db', '@commerce/core', '@commerce/config'],
  serverExternalPackages: ['postgres'],
}

export default config
