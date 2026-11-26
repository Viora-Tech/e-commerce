/** SOURCE OF TRUTH: the loyalty widget's shared class strings — WHAT: the round icon tile, the row and the accent button the panel's cards repeat / WHY: one look for every row (Points, Ways to earn, rewards, Give / Get) without a component per tile */

/** The round icon beside a row: a soft wash of the merchant colour, the icon in it. */
export const ICON_TILE =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--kl-tint) text-(--kl-accent)'

/** The merchant-coloured button (Join now, Copy link); `!` because imported themes restyle button and a. */
export const ACCENT_BUTTON =
  'inline-flex h-11 items-center justify-center rounded-xl border-0 bg-(--kl-accent)! px-5 font-semibold text-(--kl-accent-text)! no-underline!'

/** Card headings: imported themes style h3 with !important, so the widget's own wins. */
export const CARD_HEADING =
  'm-0 font-[inherit] text-[1rem]! font-bold! leading-tight! tracking-normal! normal-case! text-(--kl-ink)'
