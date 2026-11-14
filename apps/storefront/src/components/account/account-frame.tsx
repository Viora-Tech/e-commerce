import { storeCheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import type { CSSProperties, ReactNode } from 'react'
import { inStore } from '@/lib/store-context'

type AccountFrameProps = {
  /** The store whose checkout branding (accent, button, corners, type) the pages take. */
  storeId: string
  children: ReactNode
}

/*
 * The theme's own colour names point at the checkout's inside the frame, so account pieces not
 * yet drawn with --ck-* classes (addresses, profile, the nav) sit on the same canvas instead of
 * the theme's surfaces. `--color-brand` stays the theme's, so its buttons keep the store colour.
 */
const THEME_TO_CK =
  '[--color-bg:var(--ck-canvas)] [--color-ink:var(--ck-ink)] [--color-muted:var(--ck-muted)] [--color-line:var(--ck-line)] [--color-surface:var(--ck-bg)] [--color-success:var(--ck-success)] [--color-danger:var(--ck-danger)] [--font-heading:var(--ck-font)] [--font-body:var(--ck-font)]'

/**
 * The canvas, width and spacing every account page sits in, in the checkout's look (Figma
 * "Checkout · Polish"; sign-in 948:15521). `.ck` brings the checkout's palette: light, or dark
 * when the store's mode or the shopper's system setting says so. `ck-account` keeps the theme's
 * mobile dock padding, which the checkout itself drops (globals.css). The account and sign-in
 * templates draw it inside their main section (`MainAccount`, `MainLogin`), so sections a
 * merchant adds around them in Customize keep their own full width.
 */
export default async function AccountFrame({ storeId, children }: AccountFrameProps) {
  // Render logic
  const look = await inStore(storeId, (tx) => storeCheckoutLook({ tx, storeId }))
  const vars = checkoutBrandingVars(look.branding) as CSSProperties

  return (
    <div
      className={`ck ck-account bg-ck-canvas font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased ${THEME_TO_CK}`}
      style={vars}
    >
      <div className="page-width py-8 md:py-14">{children}</div>
    </div>
  )
}
