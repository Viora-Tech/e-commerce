'use client'

import { BLOCKLIST_KINDS, type BlocklistKind } from '@commerce/plugin-affiliates/fraud'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Entry = { id: string; kind: BlocklistKind; hint: string; note: string }

/** Settings › Blocklist: values the store holds or refuses, added and removed in place. */
export default function BlocklistCard() {
  // Hooks
  const { settings: copy, failed } = useCopy(affiliatesContent)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [kind, setKind] = useState<BlocklistKind>('email')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.affiliates.blocklist
      .list()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  // Event handlers
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    try {
      const added = await api.affiliates.blocklist.add({ kind, value, note })
      setEntries((list) => [added, ...(list ?? []).filter((x) => x.id !== added.id)])
      setValue('')
      setNote('')
      toast.success(copy.blocklist.added)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }
  const handleRemove = async (id: string) => {
    try {
      await api.affiliates.blocklist.remove({ id })
      setEntries((list) => (list ?? []).filter((x) => x.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Render logic
  const b = copy.blocklist

  return (
    <SettingsCard title={b.title} description={b.description}>
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <NativeSelect
          aria-label={b.kind}
          value={kind}
          onChange={(e) => setKind(BLOCKLIST_KINDS.find((k) => k === e.target.value) ?? 'email')}
          className="sm:w-44"
        >
          {BLOCKLIST_KINDS.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {b.kinds[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          aria-label={b.value}
          placeholder={b.placeholders[kind]}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <Input
          aria-label={b.note}
          placeholder={b.note}
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          className="sm:w-48"
        />
        <Button type="submit" variant="outline" disabled={busy || !value.trim()}>
          {b.add}
        </Button>
      </form>
      {entries && entries.length === 0 ? (
        <p className="text-body text-muted-foreground">{b.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {(entries ?? []).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body">
                  <span className="text-muted-foreground">{b.kinds[x.kind]}: </span>
                  <span className="font-mono">{x.hint}</span>
                </span>
                {x.note ? (
                  <span className="truncate text-caption text-muted-foreground">{x.note}</span>
                ) : null}
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleRemove(x.id)}>
                {b.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}
