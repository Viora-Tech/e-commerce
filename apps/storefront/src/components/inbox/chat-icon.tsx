type ChatIconProps = {
  kind:
    | 'chat'
    | 'bubble'
    | 'help'
    | 'expand'
    | 'shrink'
    | 'dock'
    | 'minimise'
    | 'send'
    | 'photo'
    | 'chevronDown'
    | 'chevronRight'
    | 'sparkle'
    | 'parcel'
    | 'compass'
    | 'truck'
  className?: string
}

/** Stroke paths, 24×24, drawn in `currentColor` so they follow the theme. */
const PATHS: Record<ChatIconProps['kind'], string[]> = {
  chat: ['M4 5h16v11H8l-4 4z'],
  bubble: ['M3 6h12v8H7l-4 3z', 'M9 17h8l4 3v-9h-3'],
  help: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6',
    'M12 17h.01',
  ],
  expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  shrink: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
  dock: ['M4 4h16v16H4z', 'M14 4v16'],
  minimise: ['M5 12h14'],
  send: ['M12 19V5', 'M6 11l6-6 6 6'],
  photo: ['M4 6h16v12H4z', 'M4 15l4-4 5 5', 'M14 13l2-2 4 4', 'M15.5 9.5h.01'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  sparkle: [
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    'M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  ],
  parcel: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  truck: [
    'M3 6h11v10H3z',
    'M14 10h4l3 3v3h-7',
    'M7 18.5a1.5 1.5 0 1 0 0-.01',
    'M17 18.5a1.5 1.5 0 1 0 0-.01',
  ],
}

/** The chat's few icons as inline SVG, so the widget bundle needs no icon library. */
export default function ChatIcon({ kind, className }: ChatIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
