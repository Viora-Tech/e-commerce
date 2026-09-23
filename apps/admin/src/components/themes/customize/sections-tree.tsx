'use client'

import { customizeContent } from '@/data/customize'
import {
  type CustomizeDoc,
  FOOTER_ZONE,
  HEADER_ZONE,
  MAIN_ZONE,
  zoneSections,
} from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionGroup from './section-group'

const copy = customizeContent.groups

/** The left panel's Sections tab: header group, the template's sections, footer group. */
export default function SectionsTree() {
  // Hooks
  const data = useCustomizePuck((s) => s.appState.data) as unknown as CustomizeDoc

  // Render logic
  return (
    <div className="flex flex-col">
      <SectionGroup
        title={copy.header}
        zone={HEADER_ZONE}
        group="header"
        sections={zoneSections(data, HEADER_ZONE)}
      />
      <SectionGroup
        title={copy.template}
        zone={MAIN_ZONE}
        group={null}
        sections={zoneSections(data, MAIN_ZONE)}
      />
      <SectionGroup
        title={copy.footer}
        zone={FOOTER_ZONE}
        group="footer"
        sections={zoneSections(data, FOOTER_ZONE)}
      />
    </div>
  )
}
