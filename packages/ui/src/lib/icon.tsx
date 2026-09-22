import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { forwardRef, type SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number | string
  strokeWidth?: number | string
}

export type IconComponent = ReturnType<typeof defineIcon>

/** Hugeicons stroke glyph as a drop-in component: `<Icon className="size-5" />` sizes via CSS. */
export function defineIcon(glyph: IconSvgElement, name: string) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth = 1.5, ...rest },
    ref,
  ) {
    return (
      <HugeiconsIcon
        ref={ref}
        icon={glyph}
        size={size}
        strokeWidth={Number(strokeWidth)}
        aria-hidden="true"
        {...rest}
      />
    )
  })
  Icon.displayName = name
  return Icon
}

/**
 * Custom 24-grid stroke glyph for the few kit icons Hugeicons has no match for.
 * Same props and sizing contract as `defineIcon`; `paths` are SVG path data.
 */
export function definePath(paths: readonly string[], name: string, options?: { fill?: string }) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth = 1.5, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={Number(strokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {options?.fill ? <path d={options.fill} fill="currentColor" stroke="none" /> : null}
      </svg>
    )
  })
  Icon.displayName = name
  return Icon
}
