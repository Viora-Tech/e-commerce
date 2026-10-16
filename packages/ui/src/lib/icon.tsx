import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { forwardRef, type SVGProps } from 'react'

/**
 * The old glyph-weight names, kept so call sites (`weight="fill"` on the active sidebar item,
 * `'duotone'` defaults) keep compiling. Hugeicons Stroke Rounded has one style, so a weight
 * only changes the stroke: `bold` and `fill` draw a heavier line, everything else the default.
 */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number | string
  /** Stroke width on the 24 grid; defaults to 1.5 (the Figma kit's Hugeicons stroke). */
  strokeWidth?: number | string
  /** Overrides the glyph's default weight (e.g. `fill` for the active sidebar item). */
  weight?: IconWeight
}

export type IconComponent = ReturnType<typeof defineIcon>

/** The Figma kit's icon stroke (Hugeicons Stroke Rounded at 1.5). */
const STROKE = 1.5
const HEAVY_STROKE = 2

function strokeFor(weight: IconWeight, strokeWidth: number | string | undefined): number {
  if (strokeWidth !== undefined) return Number(strokeWidth)
  return weight === 'bold' || weight === 'fill' ? HEAVY_STROKE : STROKE
}

/**
 * Hugeicons glyph (free Stroke Rounded set, MIT) as a drop-in component: `<Icon className="size-5" />`
 * sizes via CSS. `weight` is accepted for compatibility and only thickens the stroke.
 */
export function defineIcon(Glyph: IconSvgElement, name: string, weight: IconWeight = 'regular') {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth, weight: weightOverride, ...rest },
    ref,
  ) {
    return (
      <HugeiconsIcon
        ref={ref}
        icon={Glyph}
        size={size}
        strokeWidth={strokeFor(weightOverride ?? weight, strokeWidth)}
        aria-hidden="true"
        {...rest}
      />
    )
  })
  Icon.displayName = name
  return Icon
}

/**
 * Custom 24-grid stroke glyph for the handful of kit icons the icon set has no close match for.
 * Same props and sizing contract as `defineIcon`; `paths` are SVG path data.
 */
export function definePath(paths: readonly string[], name: string, options?: { fill?: string }) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 20, strokeWidth = STROKE, weight: _weight, ...rest },
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
