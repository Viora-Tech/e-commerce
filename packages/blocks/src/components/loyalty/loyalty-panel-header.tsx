'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import Icon from '../icon'
import LoyaltyIcon from './loyalty-icon'

type LoyaltyPanelHeaderProps = {
  /** The program's name ("{Store} Rewards"), or a list screen's title ("Ways to earn"). */
  title: string
  /** Home: the small line above the name ("Welcome to"); a list screen has a back arrow instead. */
  welcome?: string | undefined
  /** A member's balance, under the name on the home screen. */
  points?: string | undefined
  onBack?: (() => void) | undefined
  onClose: () => void
}

const ROUND =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-(--kl-head-text) hover:bg-white/15'

/**
 * The panel's solid header in the merchant's colours. Home: "Welcome to" over the large program
 * name (and a member's points), with room at the bottom for the first cards to overlap. A list
 * screen: back arrow, title and close in one row.
 */
export default function LoyaltyPanelHeader({
  title,
  welcome,
  points,
  onBack,
  onClose,
}: LoyaltyPanelHeaderProps) {
  // Early returns
  if (onBack)
    return (
      <header className="flex items-center gap-2 bg-(image:--kl-head) bg-(--kl-head-solid) px-3 py-3 text-(--kl-head-text)">
        <button type="button" onClick={onBack} aria-label={copy.back} className={ROUND}>
          <LoyaltyIcon name="chevron-left" className="size-5" />
        </button>
        <h2 className="m-0 min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight">{title}</h2>
        <CloseButton onClose={onClose} />
      </header>
    )

  // Render logic
  return (
    <header className="flex items-start justify-between gap-3 bg-(image:--kl-head) bg-(--kl-head-solid) px-5 pt-5 pb-14 text-(--kl-head-text)">
      <span className="flex min-w-0 flex-col gap-1">
        {welcome ? <span className="text-[0.875rem] opacity-90">{welcome}</span> : null}
        <h2 className="m-0 text-[1.5rem] font-bold leading-tight">{title}</h2>
        {points ? (
          <span className="text-[0.9375rem] font-semibold opacity-90">{points}</span>
        ) : null}
      </span>
      <CloseButton onClose={onClose} />
    </header>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label={copy.close} className={ROUND}>
      <Icon name="close" size={14} />
    </button>
  )
}
