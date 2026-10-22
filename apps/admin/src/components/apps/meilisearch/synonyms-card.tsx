'use client'

import {
  MAX_SYNONYM_GROUPS,
  parseSynonymLines,
  synonymLines,
} from '@commerce/plugin-meilisearch/settings'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { meilisearchContent } from '@/data/meilisearch'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type SynonymsCardProps = {
  synonyms: string[][]
  onSaved: () => Promise<void>
}

/** The synonyms editor: one group of same-meaning words per line, sent to Meilisearch on save. */
export default function SynonymsCard({ synonyms, onSaved }: SynonymsCardProps) {
  // Hooks
  const copy = useCopy(meilisearchContent)
  const [text, setText] = useState(() => synonymLines(synonyms))
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const groups = parseSynonymLines(text)
      await api.meilisearch.save({ synonyms: groups })
      setText(synonymLines(groups))
      await onSaved()
      toast.success(copy.synonyms.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const dirty = synonymLines(parseSynonymLines(text)) !== synonymLines(synonyms)

  return (
    <SettingsCard title={copy.synonyms.title} description={copy.synonyms.description}>
      <SettingsRow
        label={copy.synonyms.label}
        description={copy.synonyms.help(MAX_SYNONYM_GROUPS)}
        htmlFor="meilisearch-synonyms"
      >
        <Textarea
          id="meilisearch-synonyms"
          size="lg"
          rows={6}
          spellCheck={false}
          placeholder={copy.synonyms.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono"
        />
        <div>
          <Button
            variant="outline"
            loading={saving}
            disabled={saving || !dirty}
            onClick={handleSave}
          >
            <Save aria-hidden="true" />
            {copy.synonyms.save}
          </Button>
        </div>
      </SettingsRow>
    </SettingsCard>
  )
}
