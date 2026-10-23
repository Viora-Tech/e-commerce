'use client'

import {
  CHECKOUT_FONT_IDS,
  CHECKOUT_LIGHT_SURFACE,
  type CheckoutBranding,
  checkoutBrandingVars,
} from '@commerce/core/checkout-settings'
import { THEME_FONTS } from '@commerce/core/theme'
import {
  ArrowLeft,
  CheckIcon,
  ChevronDown,
  CreditCard,
  Lock,
  QrCodeIcon,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from '@commerce/ui/icons'
import type { ComponentType, CSSProperties } from 'react'
import { checkoutBrandingContent } from '@/data/checkout-settings'
import { useCopy } from '@/hooks/use-copy'

export type PreviewDevice = 'desktop' | 'phone'

type CheckoutBrandingPreviewProps = {
  branding: CheckoutBranding
  /** Settings → Checkout's order-note switch: the payment step shows the note field. */
  orderNotes: boolean
  device: PreviewDevice
  storeName: string
}

/** The curated checkout faces from Google Fonts, for this preview only; shoppers get them self-hosted. */
const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${CHECKOUT_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

/*
 * The storefront checkout's own tokens (globals.css `.ck`, `lib/checkout-classes.ts`), written
 * against the same --ck-* properties, since the admin has no storefront stylesheet.
 */
const CANVAS = 'bg-[var(--ck-canvas)] text-[color:var(--ck-ink)]'
const PANEL = 'bg-[var(--ck-bg)]'
const LINE = 'border-[color:var(--ck-line)]'
const MUTED = 'text-[color:var(--ck-muted)]'
const SUMMARY =
  'relative isolate bg-[var(--ck-summary-light)] bg-[image:var(--ck-summary-image)] bg-cover bg-center text-[color:var(--ck-summary-ink-light)]'
const SUMMARY_MUTED = 'text-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_62%,transparent)]'
const SUMMARY_LINE =
  'border-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_13%,transparent)]'
const PRIMARY =
  'flex h-7 items-center justify-center gap-1 rounded-[var(--ck-radius-button)] bg-[var(--ck-button)] px-3 text-[0.5625rem] font-semibold text-[color:var(--ck-button-ink)] shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
const SECONDARY = `flex h-7 items-center justify-center gap-1 rounded-[var(--ck-radius-button)] border ${LINE} bg-[var(--ck-field)] px-2.5 text-[0.5625rem] font-medium`
const ICON = 'size-2.5 shrink-0'

/**
 * A miniature of the storefront's stepped checkout (`CheckoutStepsShell`) on its payment step,
 * drawn from the unsaved branding: the white header with the logo and "Secure checkout", the
 * steps on the warm canvas with UPI first, the Pay button, the trust line, and the order
 * summary card on the right (a bar under the header on a phone). Same --ck-* properties as
 * the real checkout, so what the merchant sees here is what shoppers get.
 */
export default function CheckoutBrandingPreview({
  branding,
  orderNotes,
  device,
  storeName,
}: CheckoutBrandingPreviewProps) {
  // Hooks
  const copy = useCopy(checkoutBrandingContent).preview

  // Render logic
  const style = { ...CHECKOUT_LIGHT_SURFACE, ...checkoutBrandingVars(branding) } as CSSProperties
  const image = branding.summary.kind === 'image' && branding.summary.image !== null
  const phone = device === 'phone'
  const current = copy.steps.length - 1
  const wash = image ? (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-[inherit] bg-[color-mix(in_oklab,var(--ck-summary-light)_86%,transparent)]"
    />
  ) : null

  const header = (
    <div
      className={`flex items-center justify-between gap-2 border-b ${LINE} ${PANEL} ${phone ? 'px-3 py-2' : 'px-4 py-2.5'}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <ArrowLeft aria-hidden className={`${ICON} opacity-70`} />
        {branding.logo ? (
          // biome-ignore lint/performance/noImgElement: a library image a few pixels tall in a preview.
          <img
            src={branding.logo.url}
            alt={storeName}
            className="h-3.5 w-auto max-w-20 object-contain object-left"
          />
        ) : (
          <span className="truncate text-[0.6875rem] font-semibold tracking-[-0.01em]">
            {storeName}
          </span>
        )}
      </div>
      <span className={`flex shrink-0 items-center gap-1 text-[0.5rem] font-medium ${MUTED}`}>
        <Lock aria-hidden className="size-2" />
        {copy.secure}
      </span>
    </div>
  )

  const progress = phone ? (
    <div className="flex flex-col gap-1.5">
      <p className={`text-[0.5rem] ${MUTED}`}>
        {copy.stepOf} ·{' '}
        <span className="font-semibold text-[color:var(--ck-ink)]">{copy.stepHeading}</span>
      </p>
      <div className="grid grid-cols-4 gap-1">
        {copy.steps.map((s) => (
          <span key={s} className="h-0.5 rounded-full bg-[var(--ck-accent)]" />
        ))}
      </div>
    </div>
  ) : (
    <ol className="flex items-center gap-1.5">
      {copy.steps.map((s, i) => (
        <li key={s} className="contents">
          <span className="flex shrink-0 items-center gap-1">
            <span className="flex size-3.5 items-center justify-center rounded-full bg-[var(--ck-accent)] text-[0.4375rem] font-semibold text-[color:var(--ck-accent-ink)]">
              {i === current ? i + 1 : <CheckIcon aria-hidden className="size-2" />}
            </span>
            <span className={`text-[0.5rem] ${i === current ? 'font-medium' : MUTED}`}>{s}</span>
          </span>
          {i < current ? (
            <span className="h-0.5 min-w-2 flex-1 rounded-full bg-[var(--ck-accent)]" />
          ) : null}
        </li>
      ))}
    </ol>
  )

  const options: { title: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
    { title: copy.upi, hint: copy.upiHint, icon: QrCodeIcon },
    { title: copy.online, hint: copy.onlineHint, icon: CreditCard },
    { title: copy.cod, hint: copy.codHint, icon: Truck },
  ]
  const step = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.875rem] leading-tight font-semibold tracking-[-0.02em]">
          {copy.stepHeading}
        </span>
        <span className={`text-[0.5rem] ${MUTED}`}>{copy.intro}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((o, i) => {
          const Icon = o.icon
          const picked = i === 0
          return (
            <div
              key={o.title}
              className={`flex items-center gap-2 rounded-[var(--ck-radius)] border px-2 py-1.5 ${
                picked
                  ? 'border-[color:var(--ck-accent)] bg-[color-mix(in_oklab,var(--ck-accent)_7%,var(--ck-field))] shadow-[inset_0_0_0_1px_var(--ck-accent)]'
                  : `${LINE} bg-[var(--ck-field)]`
              }`}
            >
              <span
                className={`flex size-2.5 shrink-0 items-center justify-center rounded-full border ${
                  picked
                    ? 'border-[color:var(--ck-accent)] bg-[var(--ck-accent)]'
                    : 'border-[color:color-mix(in_oklab,var(--ck-muted)_60%,transparent)]'
                }`}
              >
                {picked ? <span className="size-1 rounded-full bg-[var(--ck-accent-ink)]" /> : null}
              </span>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-[var(--ck-radius)] border ${LINE} ${PANEL} ${
                  picked ? 'text-[color:var(--ck-accent)]' : MUTED
                }`}
              >
                <Icon aria-hidden className={ICON} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.5625rem] font-medium">{o.title}</span>
                <span className={`truncate text-[0.5rem] ${MUTED}`}>{o.hint}</span>
              </span>
            </div>
          )
        })}
      </div>
      {orderNotes ? (
        <div className="flex flex-col gap-1">
          <span className="text-[0.5rem] font-medium">{copy.note}</span>
          <span
            className={`h-8 rounded-[var(--ck-radius)] border ${LINE} bg-[var(--ck-field)] px-2 py-1.5 text-[0.5rem] ${MUTED}`}
          >
            {copy.notePlaceholder}
          </span>
        </div>
      ) : null}
    </div>
  )

  const trust = branding.trustBadges ? (
    <p
      className={`flex flex-wrap items-center justify-center gap-1 text-center text-[0.4375rem] ${MUTED}`}
    >
      <Lock aria-hidden className="size-2" />
      <span className="font-medium text-[color:var(--ck-ink)]">{copy.trust}</span>
      {copy.trustMethods}
    </p>
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
          <span className="font-medium tabular-nums">{item.price}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div
      role="img"
      aria-label={copy.label}
      style={style}
      className="overflow-hidden rounded-xl border border-border bg-muted p-3 font-[family-name:var(--ck-font)]"
    >
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      {phone ? (
        <div
          className={`mx-auto flex h-[30rem] w-[15rem] flex-col overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 shadow-md ${CANVAS}`}
        >
          {header}
          <div
            className={`flex items-center justify-between gap-2 border-b px-3 py-2 text-[0.5625rem] ${SUMMARY} ${SUMMARY_LINE}`}
          >
            {wash}
            <span className="flex items-center gap-1 font-medium">
              <ShoppingBag aria-hidden className={ICON} />
              {copy.showSummary}
              <ChevronDown aria-hidden className="size-2" />
            </span>
            <span className="text-[0.6875rem] font-semibold tabular-nums">{copy.total}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
            {progress}
            {step}
          </div>
          <div className={`flex flex-col gap-1.5 border-t ${LINE} ${PANEL} p-2.5`}>
            <div className="flex gap-1.5">
              <span className={`${SECONDARY} w-7 px-0`}>
                <ArrowLeft aria-hidden className={ICON} />
              </span>
              <span className={`${PRIMARY} flex-1`}>
                <Lock aria-hidden className="size-2.5 opacity-80" />
                {copy.pay}
              </span>
            </div>
            {trust}
          </div>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-md shadow-sm ${CANVAS}`}>
          {header}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-4 p-4">
            <div className="flex min-w-0 flex-col gap-3">
              {progress}
              {step}
              <div className="flex items-center justify-between gap-2">
                <span className={SECONDARY}>
                  <ArrowLeft aria-hidden className={ICON} />
                  {copy.back}
                </span>
                <span className={PRIMARY}>
                  <Lock aria-hidden className="size-2.5 opacity-80" />
                  {copy.pay}
                </span>
              </div>
              {trust}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div
                className={`flex flex-col gap-3 rounded-[calc(var(--ck-radius)*2)] border p-3 shadow-[var(--ck-card-shadow)] ${SUMMARY} ${LINE}`}
              >
                {wash}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.6875rem] font-semibold tracking-[-0.01em]">
                    {copy.summary}
                  </span>
                  <span className={`text-[0.5rem] ${SUMMARY_MUTED}`}>{copy.itemCount}</span>
                </div>
                {lines}
                <dl
                  className={`flex flex-col gap-1 border-t pt-2 text-[0.5625rem] ${SUMMARY_LINE}`}
                >
                  <div className="flex justify-between">
                    <dt className={SUMMARY_MUTED}>{copy.subtotal}</dt>
                    <dd className="tabular-nums">{copy.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className={SUMMARY_MUTED}>{copy.shipping}</dt>
                    <dd>{copy.free}</dd>
                  </div>
                </dl>
                <div
                  className={`flex items-baseline justify-between border-t pt-2 ${SUMMARY_LINE}`}
                >
                  <span className="text-[0.5625rem] font-semibold">{copy.totalLabel}</span>
                  <span className="text-[0.875rem] font-semibold tracking-[-0.02em] tabular-nums">
                    {copy.total}
                  </span>
                </div>
              </div>
              {branding.trustBadges ? (
                <div className="flex gap-1.5 px-1">
                  <ShieldCheck aria-hidden className={`${ICON} mt-px ${MUTED}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.5rem] font-medium">{copy.assurance}</span>
                    <span className={`text-[0.4375rem] ${MUTED}`}>{copy.assuranceBody}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
