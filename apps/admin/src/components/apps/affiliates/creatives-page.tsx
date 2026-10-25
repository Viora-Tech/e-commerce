'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import type { PickedMedia } from '@/components/media/media-pick-types'
import SettingsCard from '@/components/settings/settings-card'
import { affiliateCreativesContent } from '@/data/affiliate-creatives'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Creative = Awaited<ReturnType<typeof api.affiliates.creatives.list>>[number]
type Draft = {
  id?: string
  mediaId: string
  url: string
  programId: string | null
  title: string
  caption: string
}

/** The program a creative is for, or "All programs". */
const programLabel = (programs: { id: string; name: string }[], id: string | null, all: string) =>
  id ? (programs.find((p) => p.id === id)?.name ?? all) : all

/** Affiliates › Creatives: images and captions affiliates see on their dashboard, ready to post. */
export default function CreativesPage() {
  // Hooks
  const copy = useCopy(affiliateCreativesContent)
  const { failed } = useCopy(affiliatesContent)
  const [rows, setRows] = useState<Creative[] | null>(null)
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    api.affiliates.creatives.list().then(setRows)
    api.affiliates.programs
      .list()
      .then((p) =>
        setPrograms(p.filter((x) => !x.archivedAt).map((x) => ({ id: x.id, name: x.name }))),
      )
      .catch(() => setPrograms([]))
  }, [reload])

  // Event handlers
  const handlePick = (m: PickedMedia | null) => {
    setPicking(false)
    if (!m) return
    setDraft({ mediaId: m.id, url: m.url, programId: null, title: '', caption: '' })
  }
  const handleSave = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await api.affiliates.creatives.save({
        ...(draft.id ? { id: draft.id } : {}),
        mediaId: draft.mediaId,
        programId: draft.programId,
        title: draft.title,
        caption: draft.caption,
      })
      toast.success(copy.saved)
      setDraft(null)
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }
  const handleArchive = async (c: Creative) => {
    try {
      await api.affiliates.creatives.archive({ id: c.id, archived: !c.archivedAt })
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Early returns
  if (!rows) return null

  // Render logic

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<Button onClick={() => setPicking(true)}>{copy.add}</Button>}
      />
      {draft ? (
        <SettingsCard title={draft.id ? copy.edit : copy.add}>
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* biome-ignore lint/performance/noImgElement: a preview of the store's own media */}
            <img src={draft.url} alt="" className="size-32 shrink-0 rounded-lg object-cover" />
            <div className="flex flex-1 flex-col gap-3">
              <Input
                aria-label={copy.titleLabel}
                placeholder={copy.titleLabel}
                value={draft.title}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <Textarea
                aria-label={copy.caption}
                placeholder={copy.captionPlaceholder}
                rows={4}
                maxLength={2200}
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              />
              <NativeSelect
                aria-label={copy.program}
                value={draft.programId ?? ''}
                onChange={(e) => setDraft({ ...draft, programId: e.target.value || null })}
              >
                <NativeSelectOption value="">{copy.allPrograms}</NativeSelectOption>
                {programs.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
                  {copy.cancel}
                </Button>
                <Button onClick={handleSave} disabled={busy}>
                  {copy.save}
                </Button>
              </div>
            </div>
          </div>
        </SettingsCard>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-xl surface-card px-5 py-8 text-center text-body text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className={`flex flex-col gap-2 rounded-xl surface-card p-3 ${c.archivedAt ? 'opacity-60' : ''}`}
            >
              {/* biome-ignore lint/performance/noImgElement: the store's own media */}
              <img
                src={c.url}
                alt={c.title}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <p className="text-body font-medium">{c.title || copy.untitled}</p>
              {c.caption ? (
                <p className="line-clamp-2 text-caption text-muted-foreground">{c.caption}</p>
              ) : null}
              <p className="text-caption text-muted-foreground">
                {programLabel(programs, c.programId, copy.allPrograms)}
              </p>
              <div className="mt-auto flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      mediaId: c.mediaId,
                      url: c.url,
                      programId: c.programId,
                      title: c.title,
                      caption: c.caption,
                    })
                  }
                >
                  {copy.edit}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleArchive(c)}>
                  {c.archivedAt ? copy.restore : copy.archive}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <MediaPickDialog
        open={picking}
        title={copy.pick}
        empty={copy.pickEmpty}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
