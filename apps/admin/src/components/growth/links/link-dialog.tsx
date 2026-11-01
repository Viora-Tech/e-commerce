'use client'

import {
  linkSlug,
  SHORT_LINK_SLUG,
  shortLinkPath,
  storeDestination,
} from '@commerce/core/marketing'
import { Plus, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { growthLinksContent, LINK_PLACEMENTS } from '@/data/growth'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Link = Awaited<ReturnType<typeof api.shortLinks.list>>['items'][number]

type LinkDialogProps = {
  /** The link being edited, or null for a new one. */
  link: Link | null
  /** The storefront's origin; the destination must be on it. */
  origin: string
  onClose: () => void
  onSaved: () => void
}

const CUSTOM = 'custom'

/** The preset that matches a source and medium, or "custom". */
const placementOf = (source: string, medium: string) =>
  LINK_PLACEMENTS.find((p) => p.source === source && p.medium === medium)?.id ?? CUSTOM

/**
 * Figma "Marketing / Links / new link dialog": where the link goes, its short name, and the
 * tracking tags. "Where will you share it?" is the old UTM builder's preset list; picking one
 * fills Source and Medium, which stay editable.
 */
export default function LinkDialog({ link, origin, onClose, onSaved }: LinkDialogProps) {
  // Hooks
  const copy = useCopy(growthLinksContent.dialog)
  const [name, setName] = useState(link?.name ?? '')
  const [destination, setDestination] = useState(link ? `${origin}${link.destination}` : '')
  const [slug, setSlug] = useState(link?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(link !== null)
  const [source, setSource] = useState(link?.utmSource ?? '')
  const [medium, setMedium] = useState(link?.utmMedium ?? '')
  const [campaign, setCampaign] = useState(link?.utmCampaign ?? '')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  // Event handlers
  const handleName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(linkSlug(value))
  }
  const handlePlacement = (id: string) => {
    const preset = LINK_PLACEMENTS.find((p) => p.id === id)
    if (!preset) return
    setSource(preset.source)
    setMedium(preset.medium)
  }
  const handleSave = async () => {
    setTried(true)
    const path = storeDestination(destination, [new URL(origin).host])
    if (!name.trim() || !path || !SHORT_LINK_SLUG.test(slug)) return
    setBusy(true)
    const input = {
      name: name.trim(),
      slug,
      destination: path,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
    }
    try {
      if (link) await api.shortLinks.update({ id: link.id, ...input })
      else await api.shortLinks.create(input)
      toast.success(link ? copy.saved : copy.created)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const host = new URL(origin).host
  const path = storeDestination(destination, [host])
  const badDestination = tried && !path
  const badSlug = (tried || slug !== '') && !SHORT_LINK_SLUG.test(slug)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? copy.editTitle : copy.newTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field data-invalid={tried && !name.trim()}>
            <FieldLabel htmlFor="link-name">{copy.name}</FieldLabel>
            <Input
              id="link-name"
              size="lg"
              value={name}
              placeholder={copy.namePlaceholder}
              onChange={(e) => handleName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field data-invalid={badDestination}>
            <FieldLabel htmlFor="link-destination">{copy.destination}</FieldLabel>
            <Input
              id="link-destination"
              size="lg"
              value={destination}
              placeholder={copy.destinationPlaceholder}
              onChange={(e) => setDestination(e.target.value)}
              aria-invalid={badDestination}
            />
            {badDestination ? (
              <FieldError>{copy.destinationInvalid}</FieldError>
            ) : (
              <FieldDescription>{copy.destinationHelp}</FieldDescription>
            )}
          </Field>
          <Field data-invalid={badSlug}>
            <FieldLabel htmlFor="link-slug">{copy.slug}</FieldLabel>
            <Input
              id="link-slug"
              size="lg"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
              aria-invalid={badSlug}
              className="max-w-xs"
            />
            {badSlug ? (
              <FieldError>{copy.slugInvalid}</FieldError>
            ) : (
              <FieldDescription>
                {copy.slugHelp(`${host}${shortLinkPath(slug || '…')}`)}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>{copy.placement}</FieldLabel>
            <Select
              value={placementOf(source, medium)}
              onValueChange={(v) => handlePlacement(String(v))}
            >
              <SelectTrigger aria-label={copy.placement} className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_PLACEMENTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM} disabled>
                  {copy.custom}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>{copy.placementHelp}</FieldDescription>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="link-source">{copy.source}</FieldLabel>
              <Input
                id="link-source"
                size="lg"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="link-medium">{copy.medium}</FieldLabel>
              <Input
                id="link-medium"
                size="lg"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="link-campaign">{copy.campaign}</FieldLabel>
              <Input
                id="link-campaign"
                size="lg"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? <Spinner /> : link ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {link ? copy.save : copy.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
