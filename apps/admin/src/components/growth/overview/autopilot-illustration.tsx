type AutopilotIllustrationProps = { label: string }

/** Rising bars, the line they make and a small result pill: the hero's picture, drawn in our tokens. */
const BARS = [28, 36, 30, 44, 40, 52, 58, 66].map((h, i) => ({ x: 10 + i * 22, h }))
const LAST = BARS[BARS.length - 1] ?? { x: 0, h: 0 }

export default function AutopilotIllustration({ label }: AutopilotIllustrationProps) {
  // Render logic
  const points = BARS.map((b) => `${b.x + 7},${96 - b.h}`).join(' ')

  return (
    <svg viewBox="0 0 220 120" role="img" aria-label={label} className="h-28 w-auto shrink-0">
      <rect x="4" y="6" width="212" height="108" rx="12" className="fill-card stroke-border" />
      <text x="16" y="24" className="fill-muted-foreground text-[0.5rem]">
        {label}
      </text>
      {BARS.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={96 - b.h}
          width="14"
          height={b.h}
          rx="3"
          className="fill-chart-4"
        />
      ))}
      <polyline
        points={points}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-chart-1"
      />
      <circle cx={LAST.x + 7} cy={96 - LAST.h} r="3.5" className="fill-chart-1" />
      <rect x="120" y="100" width="88" height="10" rx="5" className="fill-success-soft" />
    </svg>
  )
}
