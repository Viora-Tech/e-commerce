'use client'

import { DESIGN_LIMITS, type DesignBlock } from '@commerce/notifications/design'
import SwitchRow from '@/components/fields/switch-row'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignChoiceField from './design-choice-field'
import DesignImageField from './design-image-field'
import DesignLinkField from './design-link-field'
import DesignProductsField from './design-products-field'
import type { BlockPatch } from './design-state'
import DesignTextField from './design-text-field'

const L = DESIGN_LIMITS

type DesignFieldsMoreProps = {
  block: DesignBlock
  onChange: (patch: BlockPatch) => void
}

/** The settings of the newer blocks: hero, products, discount code, video and HTML. */
export default function DesignFieldsMore({ block, onChange }: DesignFieldsMoreProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const more = useCopy(emailDesignFieldsContent)

  // Helpers
  const id = (field: string) => `design-${block.id}-${field}`
  const text = (
    field: string,
    label: string,
    value: string,
    set: (v: string) => BlockPatch,
    opts: { multiline?: boolean; max?: number } = {},
  ) => (
    <DesignTextField
      id={id(field)}
      label={label}
      value={value}
      multiline={opts.multiline}
      maxLength={opts.max ?? L.label}
      onChange={(v) => onChange(set(v))}
    />
  )

  // Render logic
  switch (block.type) {
    case 'hero': {
      const h = more.hero
      return (
        <>
          <DesignImageField
            src={block.src}
            onPick={(m) => onChange({ src: m.src, alt: block.alt || m.alt })}
          />
          {text('alt', copy.fields.alt, block.alt, (alt) => ({ alt }))}
          <DesignLinkField
            id={id('href')}
            label={h.imageLink}
            value={block.href ?? ''}
            optional
            onChange={(href) => onChange({ href: href || undefined })}
          />
          {text('heading', h.heading, block.heading, (heading) => ({ heading }))}
          {text('text', h.text, block.text, (t) => ({ text: t }), { multiline: true, max: L.text })}
          {text('buttonLabel', h.buttonLabel, block.buttonLabel, (buttonLabel) => ({
            buttonLabel,
          }))}
          {block.buttonLabel ? (
            <DesignLinkField
              id={id('buttonUrl')}
              label={h.buttonUrl}
              value={block.buttonUrl}
              onChange={(buttonUrl) => onChange({ buttonUrl })}
            />
          ) : null}
        </>
      )
    }
    case 'products': {
      const p = more.products
      return (
        <>
          {text('title', p.title, block.title, (title) => ({ title }))}
          <DesignProductsField items={block.items} onChange={(items) => onChange({ items })} />
          <DesignChoiceField
            id={id('columns')}
            label={p.columns}
            value={String(block.columns)}
            options={[
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            onChange={(v) => onChange({ columns: v === '2' ? 2 : 3 })}
          />
          <SwitchRow
            id={id('showPrice')}
            label={p.showPrice}
            checked={block.showPrice}
            onChange={(showPrice) => onChange({ showPrice })}
          />
          {text('buttonLabel', p.buttonLabel, block.buttonLabel, (buttonLabel) => ({
            buttonLabel,
          }))}
        </>
      )
    }
    case 'coupon': {
      const c = more.coupon
      return (
        <>
          {text('code', c.code, block.code, (code) => ({ code }), { max: 60 })}
          {text('label', c.label, block.label, (label) => ({ label }))}
          {text('note', c.note, block.note, (note) => ({ note }))}
          {text('value', c.value, block.value, (value) => ({ value }), { max: 20 })}
          {text('valueNote', c.valueNote, block.valueNote, (valueNote) => ({ valueNote }), {
            max: 30,
          })}
        </>
      )
    }
    case 'video': {
      const v = more.video
      return (
        <>
          <DesignImageField
            src={block.src}
            onPick={(m) => onChange({ src: m.src, alt: block.alt || m.alt })}
          />
          {text('alt', copy.fields.alt, block.alt, (alt) => ({ alt }))}
          <DesignLinkField
            id={id('url')}
            label={v.url}
            value={block.url}
            onChange={(url) => onChange({ url })}
          />
          {text('label', v.label, block.label, (label) => ({ label }))}
        </>
      )
    }
    case 'html':
      return (
        <DesignTextField
          id={id('html')}
          label={more.html.label}
          value={block.html}
          hint={more.html.hint}
          multiline
          maxLength={L.html}
          onChange={(html) => onChange({ html })}
        />
      )
    default:
      return null
  }
}
