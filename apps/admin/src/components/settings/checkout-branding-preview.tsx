'use client'

import {
  CHECKOUT_FONT_IDS,
  CHECKOUT_LIGHT_SURFACE,
  type CheckoutBranding,
  checkoutBrandingVars,
} from '@commerce/core/checkout-settings'
import { THEME_FONTS } from '@commerce/core/theme'
import { CheckIcon, ChevronDown, Lock, ShoppingBag } from '@commerce/ui/icons'
import type { CSSProperties, ReactNode } from 'react'
import { checkoutBrandingContent } from '@/data/checkout-settings'
import { useCopy } from '@/hooks/use-copy'

export type PreviewDevice = 'desktop' | 'phone'

type CheckoutBrandingPreviewProps = {
  branding: CheckoutBranding
  /** Settings → Checkout's order-note switch: the Payment card shows the note field. */
  orderNotes: boolean
  device: PreviewDevice
  storeName: string
}

type MiniCardProps = { number: number; title: string; aside?: string; children: ReactNode }
type MiniFieldProps = { label: string; value?: string }
type MiniOptionProps = { picked: boolean; title: string; hint: string; meta?: string }

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
const CARD =
  'rounded-[calc(var(--ck-radius)*1.2)] bg-[var(--ck-bg)] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.04)]'
const SUMMARY =
  'relative isolate bg-[var(--ck-summary-light)] bg-[image:var(--ck-summary-image)] bg-cover bg-center text-[color:var(--ck-summary-ink-light)]'
const SUMMARY_MUTED = 'text-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_62%,transparent)]'
const SUMMARY_LINE =
  'border-[color:color-mix(in_oklab,var(--ck-summary-ink-light)_13%,transparent)]'
const PRIMARY =
  'flex h-7 items-center justify-center gap-1 rounded-[var(--ck-radius-button)] bg-[var(--ck-button)] px-3 text-[0.5625rem] font-bold text-[color:var(--ck-button-ink)] shadow-[0_1px_2px_rgb(0_0_0/0.08)]'

/**
 * A miniature of the storefront's one-page checkout (`CheckoutForm` in a `CheckoutPageShell`),
 * drawn from the unsaved branding: the white header with the store's name and the "Secure"
 * pill, Express checkout, the numbered cards (Contact, Delivery, Shipping, Payment) on the
 * light grey canvas, and the order summary card with Pay on the right (a fold-out card on top
 * and a Pay bar at the bottom on a phone). Same --ck-* properties as the real checkout, so
 * what the merchant sees here is what shoppers get.
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
  const [contact, delivery, shipping, payment] = copy.sections
  const wash = image ? (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-[inherit] bg-[color-mix(in_oklab,var(--ck-summary-light)_86%,transparent)]"
    />
  ) : null
  const footnote = branding.trustBadges ? (
    <p className={`text-center text-[0.4375rem] ${MUTED}`}>{copy.footnote}</p>
  ) : null
  const pay = (
    <span className={PRIMARY}>
      <Lock aria-hidden className="size-2.5" />
      {copy.pay}
    </span>
  )

  const header = (
    <div
      className={`flex items-center justify-between gap-2 border-b ${LINE} ${PANEL} ${phone ? 'px-3 py-2' : 'px-4 py-2.5'}`}
    >
      {branding.logo ? (
        // biome-ignore lint/performance/noImgElement: a library image a few pixels tall in a preview.
        <img
          src={branding.logo.url}
          alt={storeName}
          className="h-3.5 w-auto max-w-20 object-contain object-left"
        />
      ) : (
        <span className="truncate text-[0.6875rem] font-extrabold tracking-[0.02em]">
          {storeName}
        </span>
      )}
      <ShoppingBag aria-hidden className="size-3 shrink-0" />
    </div>
  )

  const cards = (
    <div className="flex flex-col gap-2">
      <div className={`${CARD} flex flex-col gap-1.5 p-2.5`}>
        <span
          className={`font-mono text-[0.4375rem] font-medium tracking-[0.08em] uppercase ${MUTED}`}
        >
          {copy.express}
        </span>
        <div className="grid grid-cols-3 gap-1">
          {copy.expressApps.map((app) => (
            <span
              key={app}
              className={`flex h-5 items-center justify-center rounded-[var(--ck-radius-button)] border ${LINE} ${PANEL} text-[0.5rem] font-bold`}
            >
              {app}
            </span>
          ))}
        </div>
      </div>
      <MiniCard number={1} title={contact ?? ''} aside={copy.signIn}>
        <MiniField label={copy.mobile} />
        {phone ? null : <MiniField label={copy.email} />}
      </MiniCard>
      <MiniCard number={2} title={delivery ?? ''}>
        <div className="grid grid-cols-2 items-end gap-1.5">
          <MiniField label={copy.pincode} value="122001" />
          <span className="flex h-5 items-center gap-0.5 text-[0.4375rem] font-medium text-[color:var(--ck-success)]">
            <CheckIcon aria-hidden className="size-2 shrink-0" />
            <span className="truncate">{copy.place}</span>
          </span>
        </div>
        <MiniField label={copy.name} />
        {phone ? null : <MiniField label={copy.address} />}
      </MiniCard>
      <MiniCard number={3} title={shipping ?? ''} aside={copy.shipTo}>
        {copy.rates.map((r, i) => (
          <MiniOption key={r.name} picked={i === 0} title={r.name} hint={r.eta} meta={r.price} />
        ))}
      </MiniCard>
      <MiniCard number={4} title={payment ?? ''} aside={copy.paymentNote}>
        <MiniOption picked title={copy.upi} hint={copy.upiHint} />
        <MiniOption picked={false} title={copy.online} hint={copy.onlineHint} />
        {phone ? null : <MiniOption picked={false} title={copy.cod} hint={copy.codHint} />}
        {orderNotes && !phone ? (
          <span
            className={`h-6 rounded-[var(--ck-radius)] border ${LINE} bg-[var(--ck-field)] px-1.5 py-1 text-[0.4375rem] ${MUTED}`}
          >
            {copy.notePlaceholder}
          </span>
        ) : null}
      </MiniCard>
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
      {phone ? (
        <div
          className={`relative mx-auto flex h-[30rem] w-[15rem] flex-col overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 shadow-md ${CANVAS}`}
        >
          {header}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
            <div
              className={`${CARD} ${SUMMARY} flex items-center justify-between gap-2 px-2.5 py-2 text-[0.5625rem]`}
            >
              {wash}
              <span className="flex items-center gap-1 font-semibold">
                {copy.showSummary}
                <ChevronDown aria-hidden className="size-2" />
              </span>
              <span className="text-[0.6875rem] font-extrabold tabular-nums">{copy.total}</span>
            </div>
            {cards}
          </div>
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 border-t ${LINE} ${PANEL} px-2.5 pt-2 pb-2.5 shadow-[0_-8px_24px_rgb(0_0_0/0.06)]`}
          >
            {pay}
            {footnote}
          </div>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-md shadow-sm ${CANVAS}`}>
          {header}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] items-start gap-3 p-3">
            {cards}
            <div className={`${CARD} ${SUMMARY} flex flex-col gap-2.5 p-3`}>
              {wash}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.625rem] font-bold">{copy.summary}</span>
                <span
                  className={`rounded-[0.25rem] bg-[var(--ck-soft)] px-1 font-mono text-[0.4375rem] uppercase ${SUMMARY_MUTED}`}
                >
                  {copy.itemCount}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {copy.items.map((item) => (
                  <li key={item.title} className="flex items-center gap-1.5 text-[0.5rem]">
                    <span
                      className={`size-5 shrink-0 rounded-[var(--ck-radius)] border bg-[var(--ck-soft)] ${SUMMARY_LINE}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{item.title}</span>
                      <span className={SUMMARY_MUTED}>{item.variant}</span>
                    </span>
                    <span className="font-bold tabular-nums">{item.price}</span>
                  </li>
                ))}
              </ul>
              <dl className={`flex flex-col gap-1 border-t pt-2 text-[0.5rem] ${SUMMARY_LINE}`}>
                <div className="flex justify-between">
                  <dt className={SUMMARY_MUTED}>{copy.subtotal}</dt>
                  <dd className="tabular-nums">{copy.subtotalValue}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className={SUMMARY_MUTED}>{copy.shipping}</dt>
                  <dd className="tabular-nums">{copy.shippingValue}</dd>
                </div>
                <div
                  className={`flex items-baseline justify-between border-t pt-1.5 ${SUMMARY_LINE}`}
                >
                  <dt className="font-bold">{copy.totalLabel}</dt>
                  <dd className="text-[0.875rem] font-extrabold tracking-[-0.02em] tabular-nums">
                    {copy.total}
                  </dd>
                </div>
              </dl>
              <span
                className={`rounded-[var(--ck-radius)] bg-[var(--ck-soft)] px-1.5 py-1 text-[0.4375rem] ${MUTED}`}
              >
                {copy.deliversTo}
              </span>
              {pay}
              {footnote}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** A numbered card: the small square number in the Pay button's colour, the title, an aside. */
function MiniCard({ number, title, aside, children }: MiniCardProps) {
  return (
    <div className={`${CARD} flex flex-col gap-1.5 p-2.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[0.625rem] font-bold">
          <span className="flex size-3.5 items-center justify-center rounded-[0.25rem] bg-[var(--ck-button)] font-mono text-[0.4375rem] text-[color:var(--ck-button-ink)]">
            {number}
          </span>
          {title}
        </span>
        {aside ? <span className={`text-[0.4375rem] ${MUTED}`}>{aside}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** A label over an empty (or filled) field. */
function MiniField({ label, value }: MiniFieldProps) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[0.4375rem] font-medium opacity-80">{label}</span>
      <span
        className={`h-5 rounded-[var(--ck-radius)] border ${LINE} px-1.5 text-[0.5rem] leading-5 bg-[var(--ck-field)]`}
      >
        {value ?? ''}
      </span>
    </span>
  )
}

/** A radio card: the dot (accent ring when picked), title and hint, a price on the right. */
function MiniOption({ picked, title, hint, meta }: MiniOptionProps) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-[var(--ck-radius)] border px-2 py-1.5 ${
        picked
          ? 'border-[color:var(--ck-accent)] bg-[var(--ck-canvas)] shadow-[0_0_0_1px_var(--ck-accent)]'
          : `${LINE} ${PANEL}`
      }`}
    >
      <span
        className={`size-2.5 shrink-0 rounded-full ${picked ? 'border-[3px] border-[color:var(--ck-accent)] bg-[var(--ck-bg)]' : `border ${LINE}`}`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.5rem] font-semibold">{title}</span>
        <span className={`truncate text-[0.4375rem] ${MUTED}`}>{hint}</span>
      </span>
      {meta ? <span className="text-[0.5rem] font-bold tabular-nums">{meta}</span> : null}
    </span>
  )
}
