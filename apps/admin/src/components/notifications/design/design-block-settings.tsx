'use client'

import {
  DESIGN_LIMITS,
  type DesignBlock,
  type FreeBlock,
  type IntroBlock,
} from '@commerce/notifications/design'
import { Lock } from '@commerce/ui/icons'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignChoiceField from './design-choice-field'
import DesignImageField from './design-image-field'
import DesignLinkField from './design-link-field'
import { blockTitle, isLocked } from './design-state'
import DesignSwitchField from './design-switch-field'
import DesignTextField from './design-text-field'

type BlockPatch = Partial<FreeBlock> | Partial<IntroBlock>

type DesignBlockSettingsProps = {
  /** The selected block; null shows a hint to pick one. */
  block: DesignBlock | null
  onChange: (patch: BlockPatch) => void
}

const WIDTHS = [40, 60, 80, 100]

/** The settings of the selected block; the order's own blocks only say they are locked. */
export default function DesignBlockSettings({ block, onChange }: DesignBlockSettingsProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Helpers
  const id = (field: string) => `design-${block?.id ?? 'none'}-${field}`
  const note = (text: string) => <p className="text-caption text-muted-foreground">{text}</p>

  // Early returns
  if (!block) return <p className="text-body text-muted-foreground">{copy.editor.noneSelected}</p>

  // Render logic
  const f = copy.fields
  const fields = (() => {
    switch (block.type) {
      case 'slot':
        return isLocked(block) ? (
          <p className="flex items-start gap-2 text-body text-muted-foreground">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {copy.editor.lockedNote}
          </p>
        ) : (
          note(copy.editor.builtInNote)
        )
      case 'intro':
        return (
          <>
            <DesignTextField
              id={id('eyebrow')}
              label={f.eyebrow}
              value={block.eyebrow ?? ''}
              placeholder={f.builtInPlaceholder}
              maxLength={DESIGN_LIMITS.label}
              onChange={(eyebrow) => onChange({ eyebrow })}
            />
            <DesignTextField
              id={id('heading')}
              label={f.heading}
              value={block.heading ?? ''}
              placeholder={f.builtInPlaceholder}
              maxLength={DESIGN_LIMITS.label}
              onChange={(heading) => onChange({ heading })}
            />
            <DesignTextField
              id={id('lead')}
              label={f.lead}
              value={block.lead ?? ''}
              placeholder={f.builtInPlaceholder}
              maxLength={DESIGN_LIMITS.text}
              multiline
              onChange={(lead) => onChange({ lead })}
            />
          </>
        )
      case 'logo':
        return (
          <DesignSwitchField
            id={id('menu')}
            label={f.menu}
            checked={block.menu}
            onChange={(menu) => onChange({ menu })}
          />
        )
      case 'heading':
        return (
          <>
            <DesignTextField
              id={id('text')}
              label={f.text}
              value={block.text}
              maxLength={DESIGN_LIMITS.label}
              onChange={(text) => onChange({ text })}
            />
            <DesignChoiceField
              id={id('size')}
              label={f.size}
              value={block.size}
              options={[
                { value: 'large', label: f.large },
                { value: 'small', label: f.small },
              ]}
              onChange={(size) => onChange({ size })}
            />
          </>
        )
      case 'text':
        return (
          <>
            <DesignTextField
              id={id('text')}
              label={f.text}
              value={block.text}
              hint={f.textHint}
              multiline
              maxLength={DESIGN_LIMITS.text}
              onChange={(text) => onChange({ text })}
            />
            <DesignChoiceField
              id={id('align')}
              label={f.align}
              value={block.align}
              options={[
                { value: 'center', label: f.center },
                { value: 'left', label: f.left },
              ]}
              onChange={(align) => onChange({ align })}
            />
            <DesignSwitchField
              id={id('muted')}
              label={f.muted}
              checked={block.muted}
              onChange={(muted) => onChange({ muted })}
            />
          </>
        )
      case 'image':
        return (
          <>
            <DesignImageField
              src={block.src}
              onPick={(m) => onChange({ src: m.src, alt: block.alt || m.alt })}
            />
            <DesignTextField
              id={id('alt')}
              label={f.alt}
              value={block.alt}
              maxLength={DESIGN_LIMITS.label}
              onChange={(alt) => onChange({ alt })}
            />
            <DesignChoiceField
              id={id('width')}
              label={f.width}
              value={String(block.width)}
              options={WIDTHS.map((w) => ({ value: String(w), label: f.widthValue(w) }))}
              onChange={(w) => onChange({ width: Number(w) })}
            />
            <DesignLinkField
              id={id('href')}
              value={block.href ?? ''}
              optional
              onChange={(href) => onChange({ href: href || undefined })}
            />
          </>
        )
      case 'button':
        return (
          <>
            <DesignTextField
              id={id('label')}
              label={f.label}
              value={block.label}
              maxLength={DESIGN_LIMITS.label}
              onChange={(label) => onChange({ label })}
            />
            <DesignLinkField
              id={id('url')}
              value={block.url}
              onChange={(url) => onChange({ url })}
            />
          </>
        )
      case 'divider':
        return (
          <DesignTextField
            id={id('label')}
            label={f.dividerLabel}
            value={block.label}
            maxLength={DESIGN_LIMITS.label}
            onChange={(label) => onChange({ label })}
          />
        )
      case 'spacer':
        return (
          <DesignChoiceField
            id={id('size')}
            label={f.size}
            value={block.size}
            options={[
              { value: 'small', label: f.small },
              { value: 'medium', label: f.medium },
              { value: 'large', label: f.large },
            ]}
            onChange={(size) => onChange({ size })}
          />
        )
      case 'social':
        return note(f.socialNote)
      case 'help':
        return note(f.helpNote)
      case 'footer':
        return (
          <>
            {note(f.footerNote)}
            <DesignSwitchField
              id={id('social')}
              label={f.showSocial}
              checked={block.social}
              onChange={(social) => onChange({ social })}
            />
          </>
        )
    }
  })()

  return (
    <section aria-label={blockTitle(block, copy)} className="flex flex-col gap-3">
      <h3 className="text-card-title">{blockTitle(block, copy)}</h3>
      {fields}
    </section>
  )
}
