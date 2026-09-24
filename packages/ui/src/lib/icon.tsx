import type { IconWeight, Icon as PhosphorIcon } from '@phosphor-icons/react'
import { forwardRef, type SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number | string
  /** Kept for call-site compatibility with the old stroke-icon API; Phosphor has no stroke
   * width, so this is accepted and ignored. Use `weight` instead. */
  strokeWidth?: number | string
  /** Overrides the glyph's default weight (e.g. `fill` for the active sidebar item). */
  weight?: IconWeight
}

export type IconComponent = ReturnType<typeof defineIcon>

/**
 * Phosphor icon as a drop-in component: `<Icon className="size-5" />` sizes via CSS.
 * `weight` fixes the glyph's default style (regular by default, duotone for nav/section
 * icons), overridable per call site (e.g. `fill` for the active sidebar item).
 */
export function defineIcon(Glyph: PhosphorIcon, name: string, weight: IconWeight = 'regular') {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth: _strokeWidth, weight: weightOverride, ...rest },
    ref,
  ) {
    return (
      <Glyph ref={ref} size={size} weight={weightOverride ?? weight} aria-hidden="true" {...rest} />
    )
  })
  Icon.displayName = name
  return Icon
}

/**
 * Custom 24-grid stroke glyph for the handful of kit icons Phosphor has no close match for.
 * Same props and sizing contract as `defineIcon`; `paths` are SVG path data.
 */
export function definePath(paths: readonly string[], name: string, options?: { fill?: string }) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth = 1.6, ...rest },
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
