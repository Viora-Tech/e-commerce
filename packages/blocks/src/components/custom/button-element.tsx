import { linkTarget } from '../../link'
import { cx, safeHref } from '../../slot-types'
import ElementBox from './element-box'

export type ButtonElementProps = {
  button: { label: string; href: string; newTab?: boolean | undefined }
  variant: 'primary' | 'secondary' | 'plain'
  fullWidth: boolean
  style: unknown
}

/** A button or text link in the theme's own button styles (`.btn--primary`, `.btn--secondary`). */
export default function ButtonElement({ button, variant, fullWidth, style }: ButtonElementProps) {
  // Render logic
  const href = safeHref(button?.href) ?? '#'
  const label = button?.label || href
  const className =
    variant === 'plain'
      ? 'underline underline-offset-4'
      : cx(
          'btn',
          variant === 'secondary' ? 'btn--secondary' : 'btn--primary',
          fullWidth && 'w-full',
        )
  return (
    <ElementBox look={style} className={cx('custom-button', fullWidth && 'w-full')}>
      <a href={href} className={className} {...linkTarget(button)}>
        {label}
      </a>
    </ElementBox>
  )
}
