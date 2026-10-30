'use client'

import { MAX_SYNONYM_GROUPS } from '@commerce/core/search'
import { parseSynonymLines, synonymLines } from '@commerce/plugin-search'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { searchAppContent } from '@/data/search-app'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/**
 * The groups as text, with a new line started for `add` (the Overview's "Add synonym" on a
 * search) unless a group already holds it.
 */
function withNewLine(groups: string[][], add: string): string {
  const text = synonymLines(groups)
  const word = add.trim().toLowerCase()
  if (!word || groups.some((g) => g.includes(word))) return text
  return `${text ? `${text}\n` : ''}${word}, `
}

/** The Search & discovery app's Synonyms page: one group of same-meaning words per line. */
export default function SynonymsPage() {
  // Hooks
  const copy = useCopy(searchAppContent)
  const searchParams = useSearchParams()
  const [saved, setSaved] = useState<string[][] | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shortcut's word is read once, on load.
  useEffect(() => {
    api.search.synonyms.get().then((groups) => {
      setSaved(groups)
      setText(withNewLine(groups, searchParams.get('add') ?? ''))
    })
  }, [])

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const groups = await api.search.synonyms.set({ groups: parseSynonymLines(text) })
      setSaved(groups)
      setText(synonymLines(groups))
      toast.success(copy.synonyms.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (!saved) return null

  // Render logic
  const dirty = synonymLines(parseSynonymLines(text)) !== synonymLines(saved)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <SettingsCard title={copy.synonyms.title} description={copy.synonyms.description}>
        <SettingsRow
          label={copy.synonyms.label}
          description={copy.synonyms.help(MAX_SYNONYM_GROUPS)}
          htmlFor="search-synonyms"
        >
          <Textarea
            id="search-synonyms"
            size="lg"
            rows={8}
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
    </div>
  )
}
