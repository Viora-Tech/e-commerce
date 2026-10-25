'use client'

import type { AlternateKind } from '@commerce/core/theme'
import DataCard from '@/components/layout/data-card'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import TemplateSelectField from './template-select-field'

type TemplateSelectCardProps = {
  kind: Exclude<AlternateKind, 'page' | 'blog'>
  value: string
  onChange: (suffix: string) => void
}

/** Shopify's "Theme template" card: which alternate of the live theme lays this resource out. */
export default function TemplateSelectCard({ kind, value, onChange }: TemplateSelectCardProps) {
  // Hooks
  const copy = useCopy(customizeContent.assign)

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <TemplateSelectField kind={kind} value={value} onChange={onChange} />
    </DataCard>
  )
}
