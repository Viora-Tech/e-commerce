type ChatIconProps = {
  kind: 'chat' | 'bubble' | 'help' | 'expand' | 'shrink' | 'dock' | 'minimise' | 'send' | 'photo'
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
  send: ['M4 12l16-8-6 16-2-6z', 'M12 14l8-10'],
  photo: ['M4 6h16v12H4z', 'M4 15l4-4 5 5', 'M14 13l2-2 4 4', 'M15.5 9.5h.01'],
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
