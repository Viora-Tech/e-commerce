import type { Metadata } from 'next'
import DraftForm from '@/components/drafts/draft-form'
import { draftEditorContent } from '@/data/drafts'

export const metadata: Metadata = { title: draftEditorContent.newTitle }

export default function Page() {
  return <DraftForm draft={null} />
}
