'use client'

import {
  CHECKOUT_FONT_IDS,
  CHECKOUT_LIGHT_SURFACE,
  type CheckoutBranding,
  checkoutBrandingVars,
} from '@commerce/core/checkout-settings'
import { THEME_FONTS } from '@commerce/core/theme'
import type { CSSProperties } from 'react'
import { checkoutBrandingContent } from '@/data/checkout-settings'
import { useCopy } from '@/hooks/use-copy'

export type PreviewDevice = 'desktop' | 'phone'

type CheckoutBrandingPreviewProps = {
  branding: CheckoutBranding
  device: PreviewDevice
  storeName: string
}

/** The curated checkout faces from Google Fonts, for this preview only; shoppers get them self-hosted. */
const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${CHECKOUT_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

/* The checkout's own tokens, read from the --ck-* properties the storefront uses too. */
const SUMMARY = 'bg-[var(--ck-summary-light)] text-[color:var(--ck-summary-ink-light)]'
const SUMMARY_MUTED = 'text-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_62%,transparent)]'
const SUMMARY_LINE =
  'border-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_13%,transparent)]'
const PANEL = 'bg-[var(--ck-bg)] text-[color:var(--ck-ink)]'
const MUTED = 'text-[color:var(--ck-muted)]'
const FIELD =
  'rounded-[var(--ck-radius)] border border-[color:var(--ck-line)] bg-[var(--ck-field)] text-[color:var(--ck-muted)]'
const PAY =
  'rounded-[var(--ck-radius-button)] bg-[var(--ck-button)] text-[color:var(--ck-button-ink)] font-semibold'
const EXPRESS =
  'rounded-[var(--ck-radius-button)] bg-[var(--ck-ink)] text-[color:var(--ck-bg)] font-semibold'

/**
 * A miniature of the storefront checkout drawn from the unsaved branding, on the
 * computer layout (summary left, form right) or the phone layout (summary bar on top,
 * Pay button at the bottom). Same custom properties as the real checkout, so what the
 * merchant sees here is what shoppers get.
 */
export default function CheckoutBrandingPreview({
  branding,
  device,
  storeName,
}: CheckoutBrandingPreviewProps) {
  // Hooks
  const copy = useCopy(checkoutBrandingContent).preview

  // Render logic
  const style = { ...CHECKOUT_LIGHT_SURFACE, ...checkoutBrandingVars(branding) } as CSSProperties
  const image = branding.summary.kind === 'image' && branding.summary.image !== null
  const brand = branding.logo ? (
    // biome-ignore lint/performance/noImgElement: a library image at a few pixels tall in a preview.
    <img src={branding.logo.url} alt={storeName} className="h-4 w-auto max-w-24 object-contain" />
  ) : (
    <span className="text-[0.6875rem] font-semibold">{storeName}</span>
  )
  const summaryBackground = image ? (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 bg-[color-mix(in_oklab,var(--ck-summary-light)_86%,transparent)]"
    />
  ) : null
  const lines = (
    <ul className="flex flex-col gap-2">
      {copy.items.map((item) => (
        <li key={item.title} className="flex items-center gap-2 text-[0.5625rem]">
          <span
            className={`size-6 shrink-0 rounded-[var(--ck-radius)] border bg-[var(--ck-bg)] ${SUMMARY_LINE}`}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{item.title}</span>
            <span className={SUMMARY_MUTED}>{item.variant}</span>
          </span>
          <span className="font-medium">{item.price}</span>
        </li>
      ))}
    </ul>
  )
  const payment = (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.625rem] font-semibold">{copy.payment}</span>
      <div
        className={`flex items-center gap-2 rounded-[var(--ck-radius)] border border-[color:var(--ck-accent)] bg-[color-mix(in_oklab,var(--ck-accent)_7%,transparent)] px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--ck-accent)]`}
      >
        <span className="size-2 rounded-full bg-[var(--ck-accent)]" />
        <span className="flex flex-col text-[0.5625rem]">
          <span className="font-medium">{copy.upi}</span>
          <span className={MUTED}>{copy.upiHint}</span>
        </span>
      </div>
      <div className={`flex items-center gap-2 px-2 py-1.5 text-[0.5625rem] ${FIELD}`}>
        <span className="size-2 rounded-full border border-[color:var(--ck-muted)]" />
        <span className="font-medium text-[color:var(--ck-ink)]">{copy.cod}</span>
      </div>
    </div>
  )
  const contact = (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.625rem] font-semibold">{copy.contact}</span>
      <span className={`px-2 py-1.5 text-[0.5625rem] ${FIELD}`}>{copy.email}</span>
      <span className={`px-2 py-1.5 text-[0.5625rem] ${FIELD}`}>{copy.mobile}</span>
    </div>
  )

  return (
    <div
      role="img"
      aria-label={copy.label}
      style={style}
      className="overflow-hidden rounded-xl border border-border bg-muted p-3 font-[family-name:var(--ck-font)]"
    >
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      {device === 'desktop' ? (
        <div className="grid min-h-[24rem] grid-cols-2 overflow-hidden rounded-md shadow-sm">
          <div
            className={`relative isolate flex flex-col gap-3 bg-[image:var(--ck-summary-image)] bg-cover bg-center p-5 ${SUMMARY}`}
          >
            {summaryBackground}
            {brand}
            <span className={`text-[0.5625rem] ${SUMMARY_MUTED}`}>{copy.orderTotal}</span>
            <span className="-mt-2 text-[1.25rem] font-semibold tracking-tight">{copy.total}</span>
            {lines}
            <div className={`flex justify-between border-t pt-2 text-[0.5625rem] ${SUMMARY_LINE}`}>
              <span className="font-semibold">{copy.totalLabel}</span>
              <span className="font-semibold">{copy.total}</span>
            </div>
          </div>
          <div className={`flex flex-col gap-3 p-5 ${PANEL}`}>
            <span className={`py-1.5 text-center text-[0.5625rem] ${EXPRESS}`}>{copy.express}</span>
            {contact}
            {payment}
            <span className={`mt-auto py-1.5 text-center text-[0.625rem] ${PAY}`}>{copy.pay}</span>
            <span className={`text-center text-[0.5rem] ${MUTED}`}>{copy.trust}</span>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-[30rem] w-[15rem] flex-col overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 shadow-md">
          <div
            className={`relative isolate flex flex-col bg-[image:var(--ck-summary-image)] bg-cover bg-center ${SUMMARY}`}
          >
            {summaryBackground}
            <div className="px-3 py-2.5">{brand}</div>
            <div
              className={`flex justify-between border-y px-3 py-2 text-[0.5625rem] ${SUMMARY_LINE}`}
            >
              <span>{copy.showSummary}</span>
              <span className="font-semibold">{copy.total}</span>
            </div>
          </div>
          <div className={`flex flex-1 flex-col gap-3 p-3 ${PANEL}`}>
            <span className={`py-1.5 text-center text-[0.5625rem] ${EXPRESS}`}>{copy.express}</span>
            {contact}
            {payment}
          </div>
          <div className={`border-t border-[color:var(--ck-line)] p-2.5 ${PANEL}`}>
            <span className={`block py-1.5 text-center text-[0.625rem] ${PAY}`}>{copy.pay}</span>
          </div>
        </div>
      )}
    </div>
  )
}
