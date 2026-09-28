import { CUSTOM_ICONS, type CustomIconName } from '../../custom-icons'
import { rem } from '../../element-style'
import ElementBox from './element-box'

export type IconElementProps = { icon: CustomIconName; size: number; label: string; style: unknown }

/** One icon in the text colour. Decorative unless the merchant describes it. */
export default function IconElement({ icon, size, label, style }: IconElementProps) {
  // Render logic
  const path = CUSTOM_ICONS[icon] ?? CUSTOM_ICONS.star
  const box = rem(size, 160) ?? '1.5rem'
  return (
    <ElementBox look={style} className="custom-icon inline-flex">
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        style={{ width: box, height: box }}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
      >
        <path d={path} />
      </svg>
    </ElementBox>
  )
}
