'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import Icon from '../icon'
import LoyaltyIcon from './loyalty-icon'

type LoyaltyPanelHeaderProps = {
  /** The program's name ("{Store} Rewards"), or a list screen's title ("Ways to earn"). */
  title: string
  /** Home: the small line above the name ("Welcome to"); a list screen has a back arrow instead. */
  welcome?: string | undefined
  /** Home: the store's name in the top row. */
  storeName?: string | undefined
  onBack?: (() => void) | undefined
  onClose: () => void
}

const ROUND =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-white/15 p-0 text-(--kl-head-text) hover:bg-white/25'

/** Imported themes style h2 with !important; these keep the widget's own type. */
const HEADING = 'm-0 font-[inherit] font-bold! tracking-normal! normal-case!'

/**
 * The panel's header in the merchant's colours, Essential Loyalty's way: a gradient
 * (`--kl-hero`) with two soft circles, a gift badge and the store's name in the top row,
 * "Welcome to" over the large program name, and room at the bottom for the first card to
 * overlap. A list screen gets a compact row: back arrow, title and close.
 */
export default function LoyaltyPanelHeader({
  title,
  welcome,
  storeName,
  onBack,
  onClose,
}: LoyaltyPanelHeaderProps) {
  // Early returns
  if (onBack)
    return (
      <div className="flex shrink-0 items-center gap-2 bg-(image:--kl-hero) bg-(--kl-head-solid) px-3 py-3 text-(--kl-head-text)">
        <button type="button" onClick={onBack} aria-label={copy.back} className={ROUND}>
          <LoyaltyIcon name="chevron-left" className="size-5" />
        </button>
        <h2
          className={`${HEADING} min-w-0 flex-1 truncate text-[1rem]! leading-tight! text-(--kl-head-text)`}
        >
          {title}
        </h2>
        <CloseButton onClose={onClose} />
      </div>
    )

  // Render logic
  return (
    // A div, not <header>: imported themes style `header` (padding, position). `shrink-0`: the
    // scrolling panel must not squeeze it under the first card.
    <div className="relative isolate flex shrink-0 flex-col gap-6 overflow-hidden bg-(image:--kl-hero) bg-(--kl-head-solid) px-5 pt-4 pb-16 text-(--kl-head-text)">
      <span
        aria-hidden
        className="absolute -top-12 -right-10 -z-10 size-40 rounded-full bg-white/10"
      />
      <span
        aria-hidden
        className="absolute -bottom-16 -left-8 -z-10 size-36 rounded-full bg-white/[0.07]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20">
            <LoyaltyIcon name="gift" className="size-[1.125rem]" />
          </span>
          {storeName ? (
            <span className="truncate text-[0.875rem] font-semibold opacity-90">{storeName}</span>
          ) : null}
        </span>
        <CloseButton onClose={onClose} />
      </div>
      <div className="flex flex-col gap-1">
        {welcome ? <span className="text-[0.875rem] opacity-85">{welcome}</span> : null}
        <h2 className={`${HEADING} text-[1.625rem]! leading-tight! text-(--kl-head-text)`}>
          {title}
        </h2>
      </div>
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label={copy.close} className={ROUND}>
      <Icon name="close" size={14} />
    </button>
  )
}
