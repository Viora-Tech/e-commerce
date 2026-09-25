import { brand } from '../data/home'

type LogoMarkProps = {
  size?: number
  withWordmark?: boolean
}

export default function LogoMark({ size = 24, withWordmark = false }: LogoMarkProps) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path
          d="M6 12.5 10 16.5 18 8"
          stroke="rgb(var(--nextra-bg))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="text-[0.9375rem]">
          {brand.name}
          <span className="ms-1.5 font-normal" style={{ color: 'var(--docs-muted)' }}>
            {brand.suffix}
          </span>
        </span>
      )}
    </span>
  )
}
