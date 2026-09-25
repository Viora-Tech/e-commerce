import type { CSSProperties, ReactNode } from 'react'
import {
  type Alignment,
  type ContentWidth,
  type CornerRadius,
  migrateSectionSettings,
  type SectionSettingsValue,
  type Shadow,
  sectionVisibilityClassName,
} from '../section-settings'
import SectionReveal from './section-reveal'

type SectionFrameProps = {
  /** Legacy flat props — still supported for callers that don't pass `settings`. */
  scheme?: string
  padTop?: number
  padBottom?: number
  /** The full settings object (layout/spacing/style/advanced). Wins when given. */
  settings?: SectionSettingsValue | Record<string, unknown> | undefined
  className?: string
  children: ReactNode
}

const join = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(' ')

const WIDTH_CLASS: Record<ContentWidth, string> = {
  narrow: 'max-w-[48rem]',
  normal: '',
  wide: 'max-w-[90rem]',
  full: 'max-w-none',
}
const ALIGN_CLASS: Record<Alignment, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
}
const RADIUS_CLASS: Record<CornerRadius, string> = {
  none: '',
  sm: 'rounded-lg',
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
}
const SHADOW_CLASS: Record<Shadow, string> = { none: '', sm: 'shadow-sm', md: 'shadow-md' }

const paddingVars = (
  prefix: 'pt' | 'pb',
  value: SectionSettingsValue['spacing']['paddingTop'],
): CSSProperties =>
  ({
    [`--section-${prefix}-mobile`]: `${value.mobile}px`,
    [`--section-${prefix}-tablet`]: `${value.tablet}px`,
    [`--section-${prefix}-desktop`]: `${value.desktop}px`,
  }) as CSSProperties

/**
 * Port of snippets/section-frame.liquid: colour scheme class + vertical
 * padding — plus, when `settings` is given, the full per-section settings
 * schema (`../section-settings.ts`): content width, alignment, gap, responsive
 * padding, background/border/shadow/radius, mobile/desktop visibility and the
 * entrance animation. `settings` is optional so existing callers that only
 * ever passed `scheme`/`padTop`/`padBottom` (the storefront's dynamic-section
 * placeholders, a few `puck-config.tsx` blocks not yet migrated) keep working
 * unchanged.
 */
export default function SectionFrame({
  scheme = 'scheme-1',
  padTop = 40,
  padBottom = 40,
  settings,
  className,
  children,
}: SectionFrameProps) {
  // Early returns
  if (!settings) {
    const classes = join(
      'section-frame',
      scheme !== 'scheme-1' ? `color-${scheme}` : undefined,
      className,
    )
    return (
      <div className={classes} style={{ paddingTop: padTop, paddingBottom: padBottom }}>
        {children}
      </div>
    )
  }

  // Render logic
  const s = migrateSectionSettings({ scheme, padTop, padBottom, settings })
  const { layout, spacing, style, advanced } = s
  const hasBackgroundImage = Boolean(style.backgroundImage.url)
  const outerClasses = join(
    'section-frame',
    'relative',
    style.colorScheme !== 'scheme-1' ? `color-${style.colorScheme}` : undefined,
    RADIUS_CLASS[style.cornerRadius],
    SHADOW_CLASS[style.shadow],
    style.border ? 'border border-border' : undefined,
    hasBackgroundImage ? 'overflow-hidden' : undefined,
    sectionVisibilityClassName(advanced),
    className,
  )
  const outerStyle: CSSProperties = {
    ...paddingVars('pt', spacing.paddingTop),
    ...paddingVars('pb', spacing.paddingBottom),
    ...(style.backgroundColor ? { backgroundColor: style.backgroundColor } : {}),
  }
  const contentClasses =
    layout.contentWidth === 'full'
      ? join('relative flex flex-col', ALIGN_CLASS[layout.alignment])
      : join(
          'page-width relative flex flex-col',
          WIDTH_CLASS[layout.contentWidth],
          ALIGN_CLASS[layout.alignment],
        )
  const contentStyle: CSSProperties = { gap: layout.gap ? `${layout.gap * 0.25}rem` : undefined }

  return (
    <div
      className={outerClasses}
      style={outerStyle}
      id={advanced.anchorId || undefined}
      data-content-width={layout.contentWidth}
    >
      {hasBackgroundImage ? (
        <>
          <img
            src={style.backgroundImage.url}
            alt={style.backgroundImage.alt}
            aria-hidden={style.backgroundImage.alt ? undefined : true}
            className="absolute inset-0 size-full object-cover"
          />
          {style.overlayOpacity > 0 ? (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: style.overlayOpacity / 100 }}
            />
          ) : null}
        </>
      ) : null}
      <SectionReveal animation={advanced.entranceAnimation}>
        <div className={contentClasses} style={contentStyle}>
          {children}
        </div>
      </SectionReveal>
    </div>
  )
}
