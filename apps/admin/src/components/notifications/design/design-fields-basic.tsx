'use client'

import { type CellBlock, DESIGN_LIMITS, type DesignBlock } from '@commerce/notifications/design'
import SwitchRow from '@/components/fields/switch-row'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignButtonStyleFields from './design-button-style-fields'
import DesignChoiceField from './design-choice-field'
import DesignColourField from './design-colour-field'
import DesignFooterLinksField from './design-footer-links-field'
import DesignImageField from './design-image-field'
import DesignLinkField from './design-link-field'
import DesignRichTextField from './design-rich-text-field'
import type { BlockPatch } from './design-state'
import DesignTextField from './design-text-field'

type DesignFieldsBasicProps = {
  block: DesignBlock | CellBlock
  onChange: (patch: BlockPatch) => void
}

const WIDTHS = [40, 60, 80, 100]

/** The settings of the intro and the first blocks (logo to footer); null for any other block. */
export default function DesignFieldsBasic({ block, onChange }: DesignFieldsBasicProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const more = useCopy(emailDesignFieldsContent)

  // Helpers
  const id = (field: string) => `design-${block.id}-${field}`
  const note = (text: string) => <p className="text-caption text-muted-foreground">{text}</p>
  const f = copy.fields
  const L = DESIGN_LIMITS

  // Render logic
  switch (block.type) {
    case 'intro':
      return (
        <>
          <DesignTextField
            id={id('eyebrow')}
            label={f.eyebrow}
            value={block.eyebrow ?? ''}
            placeholder={f.builtInPlaceholder}
            maxLength={L.label}
            onChange={(eyebrow) => onChange({ eyebrow })}
          />
          <DesignTextField
            id={id('heading')}
            label={f.heading}
            value={block.heading ?? ''}
            placeholder={f.builtInPlaceholder}
            maxLength={L.label}
            onChange={(heading) => onChange({ heading })}
          />
          <DesignTextField
            id={id('lead')}
            label={f.lead}
            value={block.lead ?? ''}
            placeholder={f.builtInPlaceholder}
            maxLength={L.text}
            multiline
            onChange={(lead) => onChange({ lead })}
          />
        </>
      )
    case 'logo':
      return (
        <SwitchRow
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
            maxLength={L.label}
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
          <DesignColourField
            label={more.text.headingColour}
            value={block.colour}
            fallback="#161615"
            onChange={(colour) => onChange({ colour })}
          />
        </>
      )
    case 'text':
      return (
        <>
          {block.rich ? (
            <DesignRichTextField
              id={id('text')}
              label={f.text}
              value={block.text}
              maxLength={L.text}
              onChange={(text) => onChange({ text })}
            />
          ) : (
            <DesignTextField
              id={id('text')}
              label={f.text}
              value={block.text}
              hint={f.textHint}
              multiline
              maxLength={L.text}
              onChange={(text) => onChange({ text })}
            />
          )}
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
          <SwitchRow
            id={id('muted')}
            label={f.muted}
            checked={block.muted}
            onChange={(muted) => onChange({ muted })}
          />
          <DesignColourField
            label={more.text.colour}
            value={block.colour}
            fallback={block.muted ? '#8a8882' : '#55534d'}
            onChange={(colour) => onChange({ colour })}
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
            maxLength={L.label}
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
            maxLength={L.label}
            onChange={(label) => onChange({ label })}
          />
          <DesignLinkField id={id('url')} value={block.url} onChange={(url) => onChange({ url })} />
          <DesignButtonStyleFields
            id={id('style')}
            value={block.style}
            onChange={(style) => onChange({ style })}
          />
        </>
      )
    case 'divider':
      return (
        <>
          <DesignTextField
            id={id('label')}
            label={f.dividerLabel}
            value={block.label}
            maxLength={L.label}
            onChange={(label) => onChange({ label })}
          />
          <DesignColourField
            label={more.text.lineColour}
            value={block.colour}
            fallback="#e4e2dd"
            onChange={(colour) => onChange({ colour })}
          />
        </>
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
      return (
        <>
          <DesignTextField
            id={id('title')}
            label={more.help.title}
            value={block.title ?? ''}
            placeholder={f.builtInPlaceholder}
            maxLength={L.label}
            onChange={(title) => onChange({ title: title || undefined })}
          />
          <DesignTextField
            id={id('body')}
            label={more.help.body}
            value={block.body ?? ''}
            placeholder={f.builtInPlaceholder}
            multiline
            maxLength={L.text}
            onChange={(body) => onChange({ body: body || undefined })}
          />
          <SwitchRow
            id={id('whatsapp')}
            label={more.help.whatsapp}
            checked={block.whatsapp !== false}
            onChange={(on) => onChange({ whatsapp: on ? undefined : false })}
          />
        </>
      )
    case 'footer':
      return (
        <>
          <DesignTextField
            id={id('note')}
            label={more.footer.note}
            value={block.note ?? ''}
            placeholder={f.builtInPlaceholder}
            multiline
            maxLength={L.text}
            onChange={(n) => onChange({ note: n || undefined })}
          />
          <SwitchRow
            id={id('social')}
            label={f.showSocial}
            checked={block.social}
            onChange={(social) => onChange({ social })}
          />
          <SwitchRow
            id={id('address')}
            label={more.footer.address}
            checked={block.address !== false}
            onChange={(on) => onChange({ address: on ? undefined : false })}
          />
          <DesignFooterLinksField
            id={id('links')}
            links={block.links ?? []}
            onChange={(links) => onChange({ links })}
          />
        </>
      )
    default:
      return null
  }
}
