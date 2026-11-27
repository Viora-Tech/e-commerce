import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { fontStack } from '../pdf/fonts'
import { type TemplateId, templateFor } from '../settings'
import ClassicTemplate from './classic'
import CompactTemplate from './compact'
import MinimalTemplate from './minimal'
import PolishTemplate from './polish'
import { documentText, type TemplateProps } from './view'

export type { TemplateAssets, TemplateProps } from './view'

export const TEMPLATES: Record<TemplateId, { label: string; description: string }> = {
  classic: {
    label: 'Classic',
    description: 'Accent header, tinted cards. Adapted from invoicely.',
  },
  minimal: { label: 'Minimal', description: 'Ruled grid, no fills. Adapted from invoicely.' },
  compact: {
    label: 'GST compact',
    description: 'One column, black on white. A5 and thermal friendly.',
  },
  polish: {
    label: 'Logo left',
    description: 'Colour header band with the logo on the left, tinted totals.',
  },
  'polish-centre': {
    label: 'Logo centre',
    description: 'Colour header band with the logo, name and number centred.',
  },
  'polish-right': {
    label: 'Logo right',
    description: 'Colour header band with the logo on the right; signature on the left.',
  },
  'polish-minimal': {
    label: 'White header',
    description: 'White header under a colour rule, colour accents, no tinted cards.',
  },
}

const POLISH_LAYOUTS = {
  polish: 'left',
  'polish-centre': 'centre',
  'polish-right': 'right',
  'polish-minimal': 'minimal',
} as const

/**
 * The react-pdf <Document> for a snapshot with the store's template, colour
 * and font. Fonts must already be registered (`registerFonts`).
 */
export function documentElement(props: TemplateProps): ReactElement<DocumentProps> {
  const fontFamily = fontStack(props.settings.font, documentText(props.doc, props.settings))
  const id = templateFor(props.settings, props.doc.kind)
  if (id === 'minimal') return <MinimalTemplate {...props} fontFamily={fontFamily} />
  if (id === 'compact') return <CompactTemplate {...props} fontFamily={fontFamily} />
  if (id in POLISH_LAYOUTS) {
    const layout = POLISH_LAYOUTS[id as keyof typeof POLISH_LAYOUTS]
    return <PolishTemplate {...props} fontFamily={fontFamily} layout={layout} />
  }
  return <ClassicTemplate {...props} fontFamily={fontFamily} />
}
