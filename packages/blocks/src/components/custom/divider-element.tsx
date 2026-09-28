import { type ColourChoice, colourValue } from '../../element-style'
import ElementBox from './element-box'

export type DividerProps = {
  thickness: number
  colour: ColourChoice
  width: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  style: unknown
}

const LINE = new Set(['solid', 'dashed', 'dotted'])

/** A horizontal rule in the theme's line colour, or one the merchant picks. */
export default function DividerElement({
  thickness,
  colour,
  width,
  lineStyle,
  style,
}: DividerProps) {
  // Render logic
  const t = Math.min(Math.max(typeof thickness === 'number' ? thickness : 1, 1), 16)
  const w = Math.min(Math.max(typeof width === 'number' ? width : 100, 5), 100)
  return (
    <ElementBox look={style} className="custom-divider w-full">
      <hr
        className="mx-auto my-0 border-0"
        style={{
          width: `${w}%`,
          borderTopWidth: `${t / 16}rem`,
          borderTopStyle: LINE.has(lineStyle) ? lineStyle : 'solid',
          borderTopColor: colourValue(colour) ?? 'var(--color-line)',
        }}
      />
    </ElementBox>
  )
}
