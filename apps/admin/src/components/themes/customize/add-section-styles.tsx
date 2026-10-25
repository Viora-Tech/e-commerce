'use client'

import { presetPictureKey, type SectionPreset } from '@commerce/blocks/section-presets'
import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { CHROME_FOCUS, CHROME_GROUP_LABEL, CHROME_TRANSITION } from '@/lib/customize-chrome'
import SectionPicture, { hasSectionPicture } from './section-picture'
import SectionPreview from './section-preview'

type AddSectionStylesProps = {
  type: string
  label: string
  presets: readonly SectionPreset[]
  onPick: (presetId: string) => void
  onBack: () => void
}

const copy = customizeContent.addSection.styles

/**
 * The Add panel's second step for a section with styles (`@commerce/blocks/section-presets`):
 * one tile per style, its picture when `bun run section-previews` made one (else the section's
 * own picture or its drawn glyph), a name and one line. Picking a style adds the section with
 * those starting settings; the back button returns to the list.
 */
export default function AddSectionStyles({
  type,
  label,
  presets,
  onPick,
  onBack,
}: AddSectionStylesProps) {
  // Render logic
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.back}
          title={copy.back}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
            CHROME_FOCUS,
          )}
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
        </button>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-[0.8125rem] font-semibold text-foreground">
            {copy.title(label)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{copy.hint}</p>
        </div>
      </div>
      <p className={cn('px-2 pt-1', CHROME_GROUP_LABEL)}>{label}</p>
      <ul className="grid grid-cols-2 gap-x-2.5 gap-y-3 overflow-y-auto px-2 pb-2">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              onClick={() => onPick(preset.id)}
              aria-label={copy.add(preset.label)}
              className={cn(
                'group/style flex w-full flex-col gap-1.5 rounded-lg text-left',
                CHROME_TRANSITION,
                CHROME_FOCUS,
              )}
            >
              <span className="relative flex aspect-[128/88] w-full overflow-hidden rounded-[0.625rem] border border-border bg-muted transition-[border-color,box-shadow] group-hover/style:border-primary group-hover/style:shadow-lift group-focus-visible/style:border-primary">
                <StylePicture type={type} presetId={preset.id} label={label} style={preset.label} />
              </span>
              <span className="text-xs font-medium text-foreground">{preset.label}</span>
              <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                {preset.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The style's own picture, else the section's, else its drawn glyph. */
function StylePicture({
  type,
  presetId,
  label,
  style,
}: {
  type: string
  presetId: string
  label: string
  style: string
}) {
  // Early returns
  const key = presetPictureKey(type, presetId)
  if (hasSectionPicture(key)) {
    return (
      <SectionPicture
        type={key}
        label={copy.picture(label, style)}
        fit="tile"
        className="size-full"
      />
    )
  }
  if (hasSectionPicture(type)) {
    return <SectionPicture type={type} label={label} fit="tile" className="size-full" />
  }

  // Render logic
  return <SectionPreview type={type} className="size-full rounded-none border-0 bg-muted" />
}
