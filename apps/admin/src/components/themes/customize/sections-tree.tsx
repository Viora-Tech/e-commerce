'use client'

import { customizeContent } from '@/data/customize'
import { FOOTER_ZONE, HEADER_ZONE, MAIN_ZONE } from '@/lib/customize-doc'
import SectionGroup from './section-group'

const copy = customizeContent.groups

/** The left panel's Sections tab: header group, the template's sections, footer group. */
type SectionsTreeProps = {
  /** The open template's name, for "Template: Home page". */
  templateLabel: string
}

export default function SectionsTree({ templateLabel }: SectionsTreeProps) {
  // Render logic
  return (
    <div className="flex flex-col">
      <SectionGroup title={copy.headerGroup} everyPage zone={HEADER_ZONE} group="header" />
      <SectionGroup title={copy.templateOf(templateLabel)} zone={MAIN_ZONE} group={null} />
      <SectionGroup title={copy.footerGroup} everyPage zone={FOOTER_ZONE} group="footer" />
    </div>
  )
}
