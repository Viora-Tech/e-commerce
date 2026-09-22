import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { fontStack } from '../pdf/fonts'
import { type TemplateId, templateFor } from '../settings'
import ClassicTemplate from './classic'
import CompactTemplate from './compact'
import MinimalTemplate from './minimal'
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
}

/**
 * The react-pdf <Document> for a snapshot with the store's template, colour
 * and font. Fonts must already be registered (`registerFonts`).
 */
export function documentElement(props: TemplateProps): ReactElement<DocumentProps> {
  const fontFamily = fontStack(props.settings.font, documentText(props.doc, props.settings))
  const id = templateFor(props.settings, props.doc.kind)
  if (id === 'minimal') return <MinimalTemplate {...props} fontFamily={fontFamily} />
  if (id === 'compact') return <CompactTemplate {...props} fontFamily={fontFamily} />
  return <ClassicTemplate {...props} fontFamily={fontFamily} />
}
