type LogoMarkProps = {
  size?: number
  withWordmark?: boolean
}

export default function LogoMark({ size = 24, withWordmark = false }: LogoMarkProps) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="7" fill="var(--brand)" />
        <path
          d="M6 12.5 10 16.5 18 8"
          stroke="var(--brand-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && <span>Waimers Commerce Docs</span>}
    </span>
  )
}
