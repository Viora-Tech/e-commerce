'use client'

import { DESIGN_LIMITS, type EmailTemplateDesign } from '@commerce/notifications/design'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignOutline from './design-outline'
import DesignTextField from './design-text-field'

type DesignEditorSidebarProps = {
  design: EmailTemplateDesign
  variables: readonly string[]
  selected: string | null
  onSelect: (id: string | null) => void
  /** `group` folds a run of typing into one undo step. */
  onChange: (design: EmailTemplateDesign, group?: string) => void
}

/** The editor's left side: the subject line, blocks to add and the email's blocks in order. */
export default function DesignEditorSidebar({
  design,
  variables,
  selected,
  onSelect,
  onChange,
}: DesignEditorSidebarProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  return (
    <div className="flex flex-col gap-5">
      <DesignTextField
        id="design-subject"
        label={copy.editor.subject}
        value={design.subject ?? ''}
        hint={copy.editor.subjectHint}
        maxLength={DESIGN_LIMITS.subject}
        onChange={(subject) => onChange({ ...design, subject: subject || undefined }, 'subject')}
      />
      <DesignOutline
        design={design}
        variables={variables}
        selected={selected}
        onSelect={onSelect}
        onChange={(next) => onChange(next)}
      />
    </div>
  )
}
