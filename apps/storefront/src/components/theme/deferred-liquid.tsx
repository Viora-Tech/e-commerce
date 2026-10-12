import LiquidHtml from '@/components/theme/liquid-html'
import type { LiquidSectionHtml } from '@/lib/liquid-theme'

type DeferredLiquidProps = {
  /** The rendering of the page's later sections (`renderTemplate`), shared by all of them. */
  sections: Promise<Map<string, LiquidSectionHtml> | null>
  /** This section's Puck id. */
  id: string
}

/**
 * One of an imported theme's sections past the page's split: waits for the later sections'
 * render inside the template's Suspense boundary, so the first sections stream without it.
 */
export default async function DeferredLiquid({ sections, id }: DeferredLiquidProps) {
  // Hooks
  const section = (await sections)?.get(id)

  // Early returns
  if (!section) return null

  return <LiquidHtml {...section} />
}
