import type { Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

/**
 * Paint edge to edge on notched phones (viewport-fit=cover) so the safe-area insets are real:
 * the mobile dock, sticky add-to-cart, cart drawer and page margins pad themselves clear of
 * the notch and home indicator with env(safe-area-inset-*). Without this every env() is 0.
 * resizes-content makes the Android keyboard shrink the layout like iOS does, so bottom-pinned
 * bars and dvh panels stay above it. Zoom stays enabled (docs/conventions.md, "Motion").
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

// Root layout is shared by the store segment and the bare 404 root.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
