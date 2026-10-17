import { cn } from '@commerce/ui/lib/utils'
import { BRANDS, type BrandKey } from '@/data/logos'

type BrandLogoProps = {
  brand: BrandKey
  className?: string
}

/**
 * A partner logo, grey and quiet by default; inside a `.group` it switches to its original colours
 * on a light patch when the group is hovered. Brands with no official file show their name.
 */
export default function BrandLogo({ brand, className }: BrandLogoProps) {
  const { name, file, ratio, height } = BRANDS[brand]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 transition-colors duration-300 ease-(--ease-out) group-hover/logo:bg-white',
        className,
      )}
    >
      {file ? (
        // biome-ignore lint/performance/noImgElement: small static SVG marks; next/image adds nothing
        <img
          src={file}
          alt={name}
          width={Math.round(ratio * 24)}
          height={24}
          loading="lazy"
          decoding="async"
          className={cn(
            'w-auto max-w-28 object-contain opacity-60 transition-[opacity,filter] duration-300 ease-(--ease-out) [filter:brightness(0)_invert(1)] group-hover/logo:opacity-100 group-hover/logo:[filter:none]',
            height,
          )}
        />
      ) : (
        <span className="text-sm font-semibold text-foreground opacity-60 transition-[opacity,color] duration-300 ease-(--ease-out) group-hover/logo:text-background group-hover/logo:opacity-100">
          {name}
        </span>
      )}
    </span>
  )
}
