/** SOURCE OF TRUTH: courierLogoSrc
 * WHAT:  The logo file for a courier row, read from its label ("Xpressbees Surface via
 *        Shiprocket" → Xpressbees), from the app logos in `public/app-logos`.
 * WHY:   The Select courier drawer shows real logos (Figma 898:7790), not initials.
 * WHERE: courier-option.tsx; null falls back to the initials tile.
 */

const LOGOS: ReadonlyArray<{ match: RegExp; src: string; light?: boolean }> = [
  { match: /delhivery/i, src: '/app-logos/delhivery.png' },
  { match: /blue\s*dart/i, src: '/app-logos/bluedart.svg', light: true },
  { match: /xpress\s*bees/i, src: '/app-logos/xpressbees.png' },
  { match: /ekart/i, src: '/app-logos/ekart.png' },
  { match: /shadowfax/i, src: '/app-logos/shadowfax.png' },
  { match: /dtdc/i, src: '/app-logos/dtdc.png' },
  { match: /india\s*post|speed\s*post/i, src: '/app-logos/india-post.png' },
  { match: /\bdhl\b/i, src: '/app-logos/dhl-express.svg', light: true },
  { match: /fedex/i, src: '/app-logos/fedex.svg', light: true },
  { match: /ship\s*global/i, src: '/app-logos/shiprocket.png' },
]

/** The carrier's logo (the carrier, not the aggregator it books through), or null. */
export function courierLogoSrc(label: string): { src: string; light: boolean } | null {
  const hit = LOGOS.find((l) => l.match.test(label))
  return hit ? { src: hit.src, light: hit.light === true } : null
}
