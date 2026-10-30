'use client'

import {
  BOOST_ACTIONS,
  BOOST_FIELDS,
  type BoostAction,
  type BoostField,
  MAX_BOOST_RULES,
  MAX_BOOST_VALUE,
  type SearchBoostRule,
} from '@commerce/core/discovery'
import { Plus, Save, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useId, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'

/** Values the store's products already use, offered as each rule's choices. */
export type BoostValueChoices = Record<BoostField, string[]>

type BoostRulesCardProps = {
  rules: SearchBoostRule[]
  choices: BoostValueChoices
  onSave: (rules: SearchBoostRule[]) => Promise<void>
}

/** What is saved, for the dirty check: blank values dropped. */
const snapshot = (rules: SearchBoostRule[]): string =>
  JSON.stringify(rules.filter((r) => r.value.trim()).map((r) => [r.field, r.value.trim(), r.action]))

/** The Boosts page's "Boost and bury" card: one row per rule, saved together. */
export default function BoostRulesCard({ rules, choices, onSave }: BoostRulesCardProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const listId = useId()
  const [draft, setDraft] = useState<SearchBoostRule[]>(rules)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(rules)
  }, [rules])

  // Helpers
  const update = (i: number, patch: Partial<SearchBoostRule>) =>
    setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  // Event handlers
  const handleAdd = () => setDraft([...draft, { field: 'tag', value: '', action: 'boost' }])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft.filter((r) => r.value.trim()))
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const c = copy.boosts.rules
  const fieldItems = Object.fromEntries(BOOST_FIELDS.map((f) => [f, c.fields[f]]))
  const actionItems = Object.fromEntries(BOOST_ACTIONS.map((a) => [a, c.actions[a]]))
  const dirty = snapshot(draft) !== snapshot(rules)

  return (
    <DataCard
      title={c.title}
      subtitle={c.description}
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={draft.length >= MAX_BOOST_RULES}
          onClick={handleAdd}
        >
          <Plus aria-hidden="true" />
          {c.add}
        </Button>
      }
      footer={
        <Button variant="outline" loading={saving} disabled={saving || !dirty} onClick={handleSave}>
          <Save aria-hidden="true" />
          {c.save}
        </Button>
      }
    >
      {draft.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {draft.map((rule, i) => (
            // Rows have no id until saved; the position is their identity while editing.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <li key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_8rem_auto] sm:items-center">
              <Select
                items={fieldItems}
                value={rule.field}
                onValueChange={(v) => v && update(i, { field: v as BoostField })}
              >
                <SelectTrigger aria-label={c.field} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOST_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {c.fields[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label={c.value}
                list={`${listId}-${rule.field}`}
                value={rule.value}
                maxLength={MAX_BOOST_VALUE}
                placeholder={c.valuePlaceholder}
                onChange={(e) => update(i, { value: e.target.value })}
              />
              <Select
                items={actionItems}
                value={rule.action}
                onValueChange={(v) => v && update(i, { action: v as BoostAction })}
              >
                <SelectTrigger aria-label={c.action} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOST_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {c.actions[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={c.remove}
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {BOOST_FIELDS.map((f) => (
        <datalist key={f} id={`${listId}-${f}`}>
          {choices[f].map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}
      <p className="mt-3 text-caption text-muted-foreground">{c.limit(MAX_BOOST_RULES)}</p>
    </DataCard>
  )
}
