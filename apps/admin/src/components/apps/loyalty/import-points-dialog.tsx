'use client'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { type ChangeEvent, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { type CsvPeek, peekPointsCsv } from '@/lib/loyalty-insights'

type ImportPointsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type Preview = Awaited<ReturnType<typeof api.loyalty.insights.previewImport>>
type Result = Awaited<ReturnType<typeof api.loyalty.members.import>>
type Mode = 'set' | 'add'
type PreviewListProps = { preview: Preview; copy: (typeof loyaltyInsightsContent)['importDialog'] }

/** The API takes up to 2,000,000 characters per file. */
const MAX_CHARS = 2_000_000

/**
 * Import points from a CSV in three steps: pick the file and what the numbers do, see what
 * importing would change (a dry run on the server), then import and read what happened.
 */
export default function ImportPointsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportPointsDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const [text, setText] = useState('')
  const [peek, setPeek] = useState<CsvPeek | null>(null)
  const [mode, setMode] = useState<Mode>('set')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setText('')
    setPeek(null)
    setPreview(null)
    setResult(null)
    setMode('set')
  }

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setPreview(null)
    setResult(null)
    if (!file) return
    const body = await file.text()
    if (body.length > MAX_CHARS) {
      toast.error(copy.importDialog.tooBig)
      setText('')
      setPeek(null)
      return
    }
    setText(body)
    setPeek(peekPointsCsv(body))
  }

  const handleSubmit = async () => {
    if (result) {
      handleOpenChange(false)
      return
    }
    setBusy(true)
    try {
      if (!preview) {
        setPreview(await api.loyalty.insights.previewImport({ csv: text }))
        return
      }
      const done = await api.loyalty.members.import({ csv: text, mode })
      setResult(done)
      onImported()
    } catch (err) {
      toast.error(errorText(err, copy.importDialog.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.importDialog
  const canImport = preview !== null && preview.matched > 0
  const submitLabel = result ? d.done : preview ? (busy ? d.importing : d.import) : d.check
  const submitDisabled = result ? false : preview ? !canImport : !peek?.ok

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={result ? d.doneTitle : d.title}
      description={result ? undefined : d.body}
      submitLabel={submitLabel}
      cancelLabel={d.cancel}
      busy={busy}
      submitDisabled={submitDisabled}
      dirty={text !== '' && !result}
      onSubmit={handleSubmit}
    >
      {result ? (
        <ul className="flex flex-col gap-1 text-body">
          <li>{d.updated(f.number(result.updated))}</li>
          <li>{d.unchanged(f.number(result.unchanged))}</li>
          <li>{d.skipped(f.number(result.skipped.length + result.errors.length))}</li>
        </ul>
      ) : (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="loyalty-import-file">{d.file}</FieldLabel>
            <Input
              id="loyalty-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              disabled={busy}
            />
            {peek && !peek.ok ? (
              <FieldError>{d.missing(peek.missing.join(', '))}</FieldError>
            ) : null}
            {peek?.ok ? <FieldDescription>{d.rows(peek.rows)}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel>{d.mode}</FieldLabel>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={busy}>
              <label htmlFor="loyalty-import-set" className="flex items-center gap-2 text-body">
                <RadioGroupItem id="loyalty-import-set" value="set" />
                {d.modeSet}
              </label>
              <label htmlFor="loyalty-import-add" className="flex items-center gap-2 text-body">
                <RadioGroupItem id="loyalty-import-add" value="add" />
                {d.modeAdd}
              </label>
            </RadioGroup>
          </Field>
          {preview ? <PreviewList preview={preview} copy={d} /> : null}
        </div>
      )}
    </FormDialog>
  )
}

function PreviewList({ preview, copy }: PreviewListProps) {
  // Hooks
  const f = useFormat()

  // Render logic
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-body">
      <p className="font-medium">{copy.previewTitle}</p>
      {preview.matched === 0 ? <p className="text-danger">{copy.nothing}</p> : null}
      <ul className="flex flex-col gap-1">
        <li>{copy.matched(f.number(preview.matched))}</li>
        {preview.newMembers > 0 ? <li>{copy.newMembers(f.number(preview.newMembers))}</li> : null}
        <li>{copy.totalPoints(f.number(preview.points))}</li>
        {preview.unknownCount > 0 ? (
          <li className="text-muted-foreground">{copy.unknown(f.number(preview.unknownCount))}</li>
        ) : null}
        {preview.errorCount > 0 ? (
          <li className="text-muted-foreground">{copy.badRows(f.number(preview.errorCount))}</li>
        ) : null}
      </ul>
      {preview.errors.length > 0 || preview.unknown.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto text-caption text-muted-foreground">
          {preview.errors.slice(0, 20).map((e) => (
            <li key={`l${e.line}`}>{copy.line(e.line, e.message)}</li>
          ))}
          {preview.unknown.slice(0, 20).map((email) => (
            <li key={email}>{email}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
