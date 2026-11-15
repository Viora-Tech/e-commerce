import type { ReactNode } from 'react'

type SystemPanelProps = { children: ReactNode }

/*
 * Centred by flex and spaced by padding, never by margin utilities. Tailwind v4 puts every
 * utility in `@layer utilities`, and an unlayered stylesheet beats a layered one whatever the
 * specificity: an imported Shopify theme's `* { margin: 0 }` reset (and the same reset in our
 * blocks' base.css) zeroes `mx-auto` / `my-16`, which left these cards stuck to the top-left
 * under the header. Padding and flex are not reset, so they hold on every theme.
 * `page-width` is the theme's own content column (both Zero Drift and its imported copy define
 * it), so the card sits inside the theme's page width and gutters. An imported theme sets no
 * `--radius-card` (our theme settings write it), so the corner falls back to the theme's own
 * `--radius-m`.
 */
export const SYSTEM_PAGE = 'page-width flex justify-center py-16 md:py-24'

export const SYSTEM_PANEL =
  'flex w-full max-w-[28rem] flex-col gap-4 rounded-[var(--radius-card,var(--radius-m,0.5rem))] bg-surface p-6 md:p-8'

/**
 * The small card a system page shows inside the theme's header and footer: email unsubscribe,
 * newsletter confirm, review emails, COD confirm. Colours, type and buttons are the theme's
 * (`bg-surface`, `.h3`, `.btn`), so it reads as part of the store on any theme.
 */
export default function SystemPanel({ children }: SystemPanelProps) {
  return (
    <div className={SYSTEM_PAGE}>
      <section className={SYSTEM_PANEL}>{children}</section>
    </div>
  )
}
