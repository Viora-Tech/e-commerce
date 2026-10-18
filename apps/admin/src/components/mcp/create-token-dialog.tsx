'use client'

import { type ApiScopes, TOKEN_EXPIRY_DAYS, type TokenExpiryDays } from '@commerce/core/api-access'
import { CheckIcon, Copy } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import StatusChip from '@/components/layout/status-chip'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { tokenScopes } from './can-do'
import ScopePicker from './scope-picker'

type Created = Awaited<ReturnType<typeof api.apiAccess.createToken>>

type CreateTokenDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const START: ApiScopes = { products: 'read' }

const expiryKey = (d: TokenExpiryDays) => (d === null ? 'never' : String(d))

/**
 * Figma "Create access token", then "Token shown once": the plain token is shown here only,
 * with what it can reach and when it expires.
 */
export default function CreateTokenDialog({ open, onOpenChange }: CreateTokenDialogProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()
  const router = useRouter()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScopes>(START)
  const [expiry, setExpiry] = useState<TokenExpiryDays>(90)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleReset = () => {
    setName('')
    setScopes(START)
    setExpiry(90)
    setCreated(null)
    setCopied(false)
  }

  const handleSubmit = async () => {
    if (!Object.keys(scopes).length) {
      toast.error(copy.create.pickArea)
      return
    }
    setBusy(true)
    try {
      const r = await api.apiAccess.createToken({
        name: name.trim(),
        scopes,
        expiresInDays: expiry,
      })
      setCreated(r)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.create.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!created) return
    await navigator.clipboard.writeText(created.token)
    setCopied(true)
  }

  const handleDone = () => {
    onOpenChange(false)
    handleReset()
  }

  // Early returns
  if (created) {
    const s = tokenScopes(copy, created.grant.scopes)
    const shown = `${created.token.slice(0, 13)}${'•'.repeat(16)}${created.token.slice(-4)}`
    return (
      <Dialog open={open} onOpenChange={(o) => (o ? null : handleDone())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.shown.title}</DialogTitle>
            <DialogDescription>{copy.shown.intro}</DialogDescription>
          </DialogHeader>
          <StatusChip tone="attention" variant="dot" className="self-start">
            {copy.shown.once}
          </StatusChip>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left',
              copied ? 'border-success/30 bg-success-soft' : 'border-border bg-muted/40',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-caption text-muted-foreground">{copy.shown.label}</span>
              <span className="truncate font-mono text-body text-ink-strong">{shown}</span>
            </span>
            <span
              className={cn(
                'flex shrink-0 items-center gap-1 text-caption',
                copied ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {copied ? <CheckIcon className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? copy.shown.copied : copy.shown.copy}
            </span>
          </button>
          <dl className="flex flex-col divide-y divide-border text-body">
            {[
              [copy.shown.name, created.grant.name],
              [copy.shown.canAccess, `${s.first} · ${s.second.toLowerCase()}`],
              [
                copy.shown.expires,
                created.grant.expiresAt
                  ? format.date(created.grant.expiresAt)
                  : copy.table.expiresNever,
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button onClick={handleDone}>{copy.shown.done}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) handleReset()
      }}
      title={copy.create.title}
      description={copy.create.intro}
      submitLabel={busy ? copy.create.creating : copy.create.create}
      cancelLabel={copy.create.cancel}
      busy={busy}
      submitDisabled={!name.trim() || !Object.keys(scopes).length}
      onSubmit={handleSubmit}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="token-name">{copy.create.name}</Label>
          <Input
            id="token-name"
            value={name}
            maxLength={80}
            placeholder={copy.create.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium">{copy.create.canAccess}</span>
          <ScopePicker value={scopes} onChange={setScopes} idPrefix="token" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="token-expiry">{copy.create.expires}</Label>
          <Select
            value={expiryKey(expiry)}
            onValueChange={(v) => setExpiry(v === 'never' ? null : (Number(v) as TokenExpiryDays))}
          >
            <SelectTrigger id="token-expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOKEN_EXPIRY_DAYS.map((d) => (
                <SelectItem key={expiryKey(d)} value={expiryKey(d)}>
                  {copy.create.expiry[d === null ? 'never' : d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-caption text-muted-foreground">{copy.create.note}</p>
      </div>
    </FormDialog>
  )
}
