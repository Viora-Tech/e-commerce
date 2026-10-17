import type { SVGProps } from 'react'

/** The path of the Koomerce "K" mark; `koomerce-mark.svg` beside this file is the same shape. */
export const KOOMERCE_MARK_PATH =
  'M462 62V218A156 156 0 0 0 306 374V630L582 355H797L486 670L843 1030H630L376 780L60 1055V840C120 795 150 760 150 700V374A312 312 0 0 1 462 62Z'

/** The Koomerce "K" mark in `currentColor`, so it follows the text colour in light and dark. */
export default function KoomerceMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="40 40 830 1036" fill="currentColor" aria-hidden="true" {...props}>
      <path d={KOOMERCE_MARK_PATH} />
    </svg>
  )
}
