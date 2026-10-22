'use client'

import { METAOBJECT_PRESETS, PRESET_KEYS, type PresetKey } from '@commerce/core/metaobjects'
import {
  Clothing,
  FileText,
  Handmade,
  type IconComponent,
  Images,
  MessageSquare,
  Plus,
  Store,
  Users,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceCard from '@/components/layout/choice-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { fieldTypeContent, newContentTypeContent, presetContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { entriesPath } from './form-state'

const ICONS: Record<PresetKey | 'blank', IconComponent> = {
  size_guide: Clothing,
  faq: MessageSquare,
  team_member: Users,
  store_location: Store,
  testimonial: Handmade,
  lookbook: Images,
  blank: FileText,
}

/**
 * "What do you want to make?": picture cards for every preset in `METAOBJECT_PRESETS` plus a
 * blank start, then one question (its name) before `metaobjects.fromPreset` creates it. One
 * question per screen, so it reads the same on a phone.
 */
export default function NewContentType() {
  // Hooks
  const copy = useCopy(newContentTypeContent)
  const cards = useCopy(presetContent)
  const { types } = useCopy(fieldTypeContent)
  const router = useRouter()
  const [preset, setPreset] = useState<PresetKey | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handlePick = (key: PresetKey) => {
    setPreset(key)
    setName(METAOBJECT_PRESETS[key].name)
  }

  const handleCreate = async () => {
    if (!preset) return
    setBusy(true)
    try {
      const { type } = await api.metaobjects.fromPreset({ preset, name: name.trim() || undefined })
      toast.success(copy.created(name.trim() || METAOBJECT_PRESETS[preset].name))
      router.replace(`${entriesPath(type)}/new`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  // Render logic
  const fields = preset ? METAOBJECT_PRESETS[preset].fields : []

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={copy.title}
          summary={copy.summary}
          back={{ label: copy.back, href: routes.content.contentTypes() }}
          actions={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.content.newBlankContentType()} />}
            >
              <Plus aria-hidden="true" />
              {copy.startBlank}
            </Button>
          }
        />
      }
      main={
        preset ? (
          <Card size="form">
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-card-title text-ink-strong">{copy.name.heading}</h2>
                <p className="text-body text-muted-foreground">{copy.name.body}</p>
              </div>
              <Field>
                <FieldLabel htmlFor="content-type-name">{copy.name.label}</FieldLabel>
                <Input
                  id="content-type-name"
                  size="lg"
                  value={name}
                  maxLength={100}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <p className="text-body-strong">{copy.name.fields}</p>
                <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                  {fields.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-body">{f.name}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {types[f.type].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="lg" disabled={busy} onClick={() => setPreset(null)}>
                  {copy.name.change}
                </Button>
                <Button size="lg" disabled={busy} onClick={handleCreate}>
                  <Plus aria-hidden="true" />
                  {busy ? copy.name.creating : copy.name.create}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-card-title text-ink-strong">{copy.pick.heading}</h2>
              <p className="text-body text-muted-foreground">{copy.pick.body}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {PRESET_KEYS.map((key) => (
                <ChoiceCard
                  key={key}
                  icon={ICONS[key]}
                  label={cards[key].title}
                  description={cards[key].body}
                  selected={false}
                  onSelect={() => handlePick(key)}
                  layout="tile"
                />
              ))}
              <ChoiceCard
                icon={ICONS.blank}
                label={cards.blank.title}
                description={cards.blank.body}
                selected={false}
                onSelect={() => router.push(routes.content.newBlankContentType())}
                layout="tile"
              />
            </div>
          </>
        )
      }
    />
  )
}
