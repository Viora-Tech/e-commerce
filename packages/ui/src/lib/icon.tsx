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
