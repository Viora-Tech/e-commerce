import { brand } from '../data/home'

type LogoMarkProps = {
  size?: number
  withWordmark?: boolean
}

export default function LogoMark({ size = 24, withWordmark = false }: LogoMarkProps) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      {/* The Koomerce "K" (packages/ui/src/brand/koomerce-mark.tsx), in the text colour. */}
      <svg
        width={size}
        height={size}
        viewBox="40 40 830 1036"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M462 62V218A156 156 0 0 0 306 374V630L582 355H797L486 670L843 1030H630L376 780L60 1055V840C120 795 150 760 150 700V374A312 312 0 0 1 462 62Z" />
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
