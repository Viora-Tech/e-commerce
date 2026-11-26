/** SOURCE OF TRUTH: the loyalty widget's shared class strings — WHAT: the near-black button, the list row, the card heading and the progress bar the panel, the product line, the cart box and the landing page repeat / WHY: one look for every surface without a component per tile; `!` because imported Liquid themes style button, a and h3 with !important */

/** Join now, Claim, Redeem and apply: near-black with white text (Essential Loyalty's look). */
export const DARK_BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center rounded-[0.375rem]! border-0! bg-(--kl-button)! px-7! text-[0.875rem]! font-semibold! normal-case! tracking-normal! text-(--kl-button-text)! no-underline! shadow-none! transition-[opacity] duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-60'

/** A brand-coloured text link ("Sign in"). */
export const ACCENT_LINK = 'font-semibold text-(--kl-accent)! no-underline! hover:underline!'

/** One clickable row in a card: icon, label, chevron. */
export const ROW_BUTTON =
  'flex w-full min-h-11 cursor-pointer touch-manipulation items-center gap-3 border-0! bg-transparent! px-0! py-2.5 text-left text-[0.875rem]! font-normal! normal-case! tracking-normal! text-(--kl-ink)! shadow-none!'

/** Card headings: imported themes style h3 with !important, so the widget's own wins. */
export const CARD_HEADING =
  'm-0 font-[inherit] text-[0.9375rem]! font-bold! leading-tight! tracking-normal! normal-case! text-(--kl-ink)!'

/** The thin bar under a reward (points toward it) and on the Next reward card. */
export const PROGRESS_TRACK = 'block h-1.5 w-full overflow-hidden rounded-full bg-(--kl-line)'
export const PROGRESS_FILL = 'block h-full rounded-full bg-(--kl-accent)'

/** A round icon button (close, back, copy, share). */
export const ICON_BUTTON =
  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full! border-0! bg-transparent! p-0! shadow-none! text-inherit hover:bg-black/5!'
