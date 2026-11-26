import type { LoyaltyLauncherIcon } from './loyalty-settings'

/** Every glyph the widget draws: the launcher's choices, the list rows' icons and the arrows. */
export type LoyaltyGlyph =
  | Exclude<LoyaltyLauncherIcon, 'none'>
  | 'cake'
  | 'mail'
  | 'bag'
  | 'cart'
  | 'user'
  | 'id-card'
  | 'calendar'
  | 'eye'
  | 'flame'
  | 'chat'
  | 'share'
  | 'tag'
  | 'ticket'
  | 'truck'
  | 'wallet'
  | 'coins'
  | 'coin'
  | 'hand-coin'
  | 'award'
  | 'percent'
  | 'copy'
  | 'check'
  | 'close'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-up'
  | 'whatsapp'
  | 'email'
  | 'x'
  | 'facebook'
  | 'messenger'
  | 'threads'
  | 'telegram'

type LoyaltyIconProps = {
  name: LoyaltyGlyph
  className?: string
}

/** Outline glyphs (24 grid, currentColor), drawn in the brand colour by the widget. */
const PATHS: Record<LoyaltyGlyph, string> = {
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.25C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.25C17 7 14.5 7 12 7z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z',
  crown: 'M4 18h16M5 15l-1.5-8 5 4L12 5l3.5 6 5-4L19 15z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  cake: 'M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  cart: 'M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4M9.5 19.5a1 1 0 1 0 0-.01M17 19.5a1 1 0 1 0 0-.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  'id-card':
    'M3 5h18v14H3zM9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4M14.5 9.5h4M14.5 13h3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flame:
    'M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3.5 3 5 1-1 1.5-2.5 1.5-3.5 2.5 2 5 4.5 5 7.5 0 3.4-2.6 6-6.5 6z',
  chat: 'M4 5h16v11H9l-5 4z',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM9 7v10M12.5 10.5h4M12.5 13.5h3',
  truck:
    'M2 6h12v10H2zM14 9h4l3 3v4h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wallet: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2',
  coins:
    'M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  'hand-coin':
    'M15 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 13.5h3v7h-3zM5.5 19.5l7.5 1.5 8.5-4.5a1.6 1.6 0 0 0-1.9-2.5L15 16M5.5 14.5l3.2-1.3a3 3 0 0 1 2.6.1l2.2 1.2a1.3 1.3 0 0 1-1.2 2.3L9.5 15.5',
  award:
    'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 6.3l1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.7-1.7 2.4-.4zM8.5 14l-1.5 7 5-2.5 5 2.5-1.5-7',
  percent: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M6 15l6-6 6 6',
  whatsapp:
    'M3.5 20.5l1.3-4.3A8.5 8.5 0 1 1 8 19.3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.5-2.4-1.7-2.9-2.9l1-1-1-2z',
  x: 'M4 4l16 16M20 4L4 20',
  facebook:
    'M14.5 8.5H16V5.2h-2.3a3.5 3.5 0 0 0-3.5 3.5V11H8v3.2h2.2V21h3.3v-6.8H16l.4-3.2h-2.9V9.5a1 1 0 0 1 1-1z',
  messenger:
    'M12 3c-5 0-9 3.7-9 8.4 0 2.6 1.2 4.9 3.2 6.4V21l2.9-1.6c.9.3 1.9.4 2.9.4 5 0 9-3.7 9-8.4S17 3 12 3zM7 13.5l3.5-3.7 2.3 2.2 4.2-2.2-3.5 3.7-2.3-2.2z',
  threads:
    'M16.5 11.2c-.3-2.5-2-3.9-4.4-3.9-1.8 0-3.1.9-3.7 2.2M12.3 20.5c-4.6 0-7.6-3-7.6-8.5S7.7 3.5 12.3 3.5c3.6 0 6 1.7 7 4.8M15.8 12.7c0 2.4-1.4 3.8-3.4 3.8-1.6 0-2.6-.9-2.6-2.1 0-1.6 1.7-2.4 4.2-2.4 3.6 0 5.5 1.4 5.5 3.4 0 2.6-2.6 5.1-7.2 5.1',
  telegram: 'M21 4L3 11l6 2.2M21 4l-3 16-6.5-5.3M21 4L9 13.2v5.3l2.5-3.8',
}

/** A small outline icon for the loyalty widget (launcher, list rows, share buttons, arrows). */
export default function LoyaltyIcon({ name, className = 'size-5' }: LoyaltyIconProps) {
  // Render logic
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
