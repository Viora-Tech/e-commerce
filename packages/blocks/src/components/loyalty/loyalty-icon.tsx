import type { LoyaltyLauncherIcon } from './loyalty-settings'

type LoyaltyIconProps = {
  name: Exclude<LoyaltyLauncherIcon, 'none'>
  className?: string
}

/** Outline glyphs (24 grid, currentColor) for the launcher. */
const PATHS: Record<LoyaltyIconProps['name'], string> = {
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.25C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.25C17 7 14.5 7 12 7z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z',
  crown: 'M4 18h16M5 15l-1.5-8 5 4L12 5l3.5 6 5-4L19 15z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
}

/** A small icon for the loyalty launcher; the merchant picks it in the embed settings. */
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
