'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyIcon from './loyalty-icon'
import { ICON_BUTTON } from './loyalty-styles'

type LoyaltyPanelHeaderProps = {
  /** The program's name ("{Store} Rewards"), or a list screen's title ("Ways to earn"). */
  title: string
  /** Home, visitor: the small line above the name ("Welcome to"). */
  welcome?: string | undefined
  /** Home, member: the balance shown in a pill instead of the name ("Your balance" · 1,250). */
  balance?: number | undefined
  /** A list screen: a back arrow before the title. */
  onBack?: (() => void) | undefined
  onClose: () => void
  /** The id the panel's `aria-labelledby` points at. */
  titleId: string
}

/** Imported themes style h2 with !important; these keep the widget's own type. */
const HEADING = 'm-0 font-[inherit] font-bold! tracking-normal! normal-case! text-(--kl-head-text)!'

/**
 * The panel's header on the brand colour, Essential Loyalty's way. Home: "Welcome to" over the
 * program name (a visitor) or "Your balance" over a pill with the points (a member), close at the
 * top right. A list screen: back arrow, title and close on one row. The colour carries on behind
 * the first card and fades to white (the panel's scroll area paints that).
 */
export default function LoyaltyPanelHeader({
  title,
  welcome,
  balance,
  onBack,
  onClose,
  titleId,
}: LoyaltyPanelHeaderProps) {
  // Early returns
  if (onBack)
    return (
      <div className="flex items-center gap-2 px-4 pt-4 pb-5 text-(--kl-head-text)">
        <button type="button" onClick={onBack} aria-label={copy.back} className={ICON_BUTTON}>
          <LoyaltyIcon name="chevron-left" className="size-5" />
        </button>
        <h2 id={titleId} className={`${HEADING} min-w-0 flex-1 truncate text-[1.0625rem]!`}>
          {title}
        </h2>
        <CloseButton onClose={onClose} />
      </div>
    )

  // Render logic
  return (
    // A div, not <header>: imported themes style `header` (padding, position).
    <div className="flex items-start justify-between gap-3 px-5 pt-6 pb-7 text-(--kl-head-text)">
      {balance === undefined ? (
        <div className="flex min-w-0 flex-col gap-3">
          {welcome ? <span className="text-[0.9375rem] font-semibold">{welcome}</span> : null}
          <h2 id={titleId} className={`${HEADING} text-[1.375rem]! leading-tight!`}>
            {title}
          </h2>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <h2 id={titleId} className={`${HEADING} text-[0.9375rem]! font-semibold!`}>
            {copy.headerBalance}
          </h2>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/20 px-3 py-1.5">
            <LoyaltyIcon name="coin" className="size-[1.125rem]" />
            <span className="text-[1.25rem] font-bold leading-none tabular-nums">
              {balance.toLocaleString('en-IN')}
            </span>
          </span>
        </div>
      )}
      <CloseButton onClose={onClose} />
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label={copy.close} className={ICON_BUTTON}>
      <LoyaltyIcon name="close" className="size-5" />
    </button>
  )
}
