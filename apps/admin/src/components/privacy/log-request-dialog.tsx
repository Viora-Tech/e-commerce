'use client'

import { type DataRequestKind, STAFF_REQUEST_SOURCES } from '@commerce/core/privacy'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceList from '@/components/returns/choice-list'
import { logRequestContent as copy, SOURCE_LABEL } from '@/data/customer-privacy'
import { api } from '@/lib/api-client'

type LogRequestDialogProps = {
  open: boolean
  onClose: () => void
  onLogged: () => void
  /** Opened from a customer's page: that customer is already chosen. */
  customer?: { id: string; label: string } | undefined
}

type Match = { id: string; label: string; detail: string }

type Source = (typeof STAFF_REQUEST_SOURCES)[number]

const isSource = (v: string): v is Source =>
  (STAFF_REQUEST_SOURCES as readonly string[]).includes(v)

/** Staff log a request that arrived by email, phone or in person. */
export default function LogRequestDialog({
  open,
  onClose,
  onLogged,
  customer,
}: LogRequestDialogProps) {
  // Hooks
  const [kind, setKind] = useState<DataRequestKind>('export')
  const [source, setSource] = useState<Source>('email')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(customer ?? null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (picked || q.length < 3) {
      setMatches(null)
      return
    }
    const timer = setTimeout(() => {
      api.customers
        .list({ search: q, page: 1, perPage: 5 })
        .then((r) =>
          setMatches(
            r.items.map((c) => ({
              id: c.id,
              label: c.name || c.email || c.phone || c.id,
              detail: [c.email, c.phone].filter(Boolean).join(' · '),
            })),
          ),
        )
        .catch(() => setMatches([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, picked])

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.customerPrivacy.createRequest({
        kind,
        source,
        customerId: picked?.id ?? null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        note: note.trim() || null,
      })
      toast.success(copy.logged(r.number))
      setQuery('')
      setNote('')
      setContactEmail('')
      setContactPhone('')
      setPicked(customer ?? null)
      onLogged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{copy.kind}</FieldLabel>
              <ChoiceList
                name="request-kind"
                value={kind}
                onChange={(v) => setKind(v === 'delete' ? 'delete' : 'export')}
                choices={[
                  { value: 'export', ...copy.kinds.export },
                  { value: 'delete', ...copy.kinds.delete },
                ]}
              />
            </Field>
            <Field>
              <FieldLabel>{copy.source}</FieldLabel>
              <ChoiceList
                name="request-source"
                value={source}
                onChange={(v) => isSource(v) && setSource(v)}
                choices={STAFF_REQUEST_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="request-customer">{copy.customer}</FieldLabel>
              {picked ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="truncate text-body">{picked.label}</span>
                  {customer ? null : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                      {copy.clear}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Input
                    id="request-customer"
                    value={query}
                    placeholder={copy.customerPlaceholder}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {matches && matches.length === 0 ? (
                    <FieldDescription>{copy.noMatch}</FieldDescription>
                  ) : null}
                  {matches && matches.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                            onClick={() => setPicked({ id: m.id, label: m.label })}
                          >
                            <span className="text-body">{m.label}</span>
                            {m.detail ? (
                              <span className="text-caption text-muted-foreground">{m.detail}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <FieldDescription>{copy.customerHelp}</FieldDescription>
                  )}
                </>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="request-email">{copy.contactEmail}</FieldLabel>
                <Input
                  id="request-email"
                  type="email"
                  inputMode="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="request-phone">{copy.contactPhone}</FieldLabel>
                <Input
                  id="request-phone"
                  type="tel"
                  inputMode="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="request-note">{copy.note}</FieldLabel>
              <Textarea
                id="request-note"
                rows={3}
                value={note}
                placeholder={copy.notePlaceholder}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
