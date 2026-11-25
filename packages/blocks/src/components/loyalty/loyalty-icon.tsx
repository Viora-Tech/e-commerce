import type { LoyaltyLauncherIcon } from './loyalty-settings'

/** Every glyph the widget draws: the launcher's choices, the list rows' icons and the arrows. */
export type LoyaltyGlyph =
  | Exclude<LoyaltyLauncherIcon, 'none'>
  | 'cake'
  | 'mail'
  | 'bag'
  | 'user'
  | 'calendar'
  | 'eye'
  | 'flame'
  | 'chat'
  | 'share'
  | 'tag'
  | 'truck'
  | 'wallet'
  | 'coins'
  | 'chevron-right'
  | 'chevron-left'

type LoyaltyIconProps = {
  name: LoyaltyGlyph
  className?: string
}

/** Outline glyphs (24 grid, currentColor). */
const PATHS: Record<LoyaltyGlyph, string> = {
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.25C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.25C17 7 14.5 7 12 7z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z',
  crown: 'M4 18h16M5 15l-1.5-8 5 4L12 5l3.5 6 5-4L19 15z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  cake: 'M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flame:
    'M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3.5 3 5 1-1 1.5-2.5 1.5-3.5 2.5 2 5 4.5 5 7.5 0 3.4-2.6 6-6.5 6z',
  chat: 'M4 5h16v11H9l-5 4z',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  truck:
    'M2 6h12v10H2zM14 9h4l3 3v4h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wallet: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2',
  coins:
    'M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
}

/** A small outline icon for the loyalty widget (launcher, list rows, arrows). */
export default function LoyaltyIcon({ name, className = 'size-5' }: LoyaltyIconProps) {
  // Render logic
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
