/*
 * Class lists the shopper account pages share (sign-in, orders, order detail). They are drawn in
 * the checkout's look (`checkout-classes.ts`, --ck-* tokens), inside `AccountFrame`'s `.ck`
 * scope, so light or dark follows the store's mode or the shopper's system setting exactly as
 * the checkout does. `!` beats the theme's unlayered base rules, as in the checkout.
 *
 * Headings also opt out of the theme's scroll reveal (`html.js main h1` starts at opacity 0 and
 * only headings present at page load are watched): a step swapped in on the client, like
 * "Enter the code", would otherwise stay invisible (#200).
 */

import { CK_CARD, CK_LIFT } from '@/lib/checkout-classes'

const HEADING =
  'font-ck! normal-case! tracking-normal! text-ck-ink! opacity-100! translate-none! [text-wrap:balance]'

/** The page or card title: "Sign in", "Enter the code", "Order #1042". */
export const ACCOUNT_TITLE = `${HEADING} text-[1.75rem]! leading-[1.15]! font-bold!`

/** A card's heading: "Tracking", "Items", "Summary". */
export const ACCOUNT_CARD_TITLE = `${HEADING} text-[1.0625rem]! leading-snug! font-semibold!`

/** A card on the account canvas, rising in on load (a fade alone with reduced motion). */
export const ACCOUNT_CARD = `${CK_CARD} ${CK_LIFT} flex flex-col gap-4 p-5 sm:p-6`

/** Quiet text actions, each still a full 2.75rem tap: "Back", "Use email instead". */
export const ACCOUNT_LINK =
  'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-sm bg-transparent! p-0! text-[0.875rem]! font-medium! text-ck-ink! no-underline outline-none touch-manipulation hover:underline underline-offset-4 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-50'

/** An error line under a field or a step, read out as it appears. */
export const ACCOUNT_ERROR = 'flex items-start gap-2 text-[0.8125rem] leading-snug text-ck-danger'

/**
 * A short stagger for lists arriving together (order cards): pass the row index as `--i`.
 * Capped so a long list does not keep the last cards waiting.
 */
export const ACCOUNT_STAGGER = '[animation-delay:calc(min(var(--i),6)*40ms)]'
