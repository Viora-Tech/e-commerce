import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'

/**
 * The admin as an installable app. An iPhone sends web push only to a site added to the Home
 * Screen, so Account → Notifications → Push needs this; on Android and desktops it only adds
 * "Install". Opens on Home, full screen, in the admin's dark brand colour.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.brand.name} Admin`,
    short_name: siteConfig.brand.name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#151515',
    theme_color: '#151515',
    icons: [
      { src: '/brand/push-icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
