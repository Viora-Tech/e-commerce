'use client'

import { NEW_FILE_KINDS, type NewFileKind } from '@commerce/core/theme-code'
import { Braces, FileText, LayoutGrid, SquareTerminal } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type CodeAddFileDialogProps = {
  open: boolean
  themeId: string
  kinds: readonly NewFileKind[]
  onOpenChange: (open: boolean) => void
  onCreated: (path: string) => void
}

const ICONS: Record<NewFileKind, typeof FileText> = {
  section: LayoutGrid,
  snippet: Braces,
  block: LayoutGrid,
  template: FileText,
  stylesheet: SquareTerminal,
  script: SquareTerminal,
  layout: FileText,
  locale: Braces,
}

/**
 * Add a new file (Figma 699:94667): what it is, as tiles with their folder and extension, then
 * its name between the folder and the extension. ⌘N or "+" in Files opens it.
 */
export default function CodeAddFileDialog({
  open,
  themeId,
  kinds,
  onOpenChange,
  onCreated,
}: CodeAddFileDialogProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.add)
  const nameId = useId()
  const [kind, setKind] = useState<NewFileKind>(kinds[0] ?? 'template')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    setError(null)
    try {
      const { path } = await api.themes.code.create({ themeId, kind, name: name.trim() })
      toast.success(copy.created(path))
      handleOpenChange(false)
      onCreated(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Render logic
  const { folder, ext } = NEW_FILE_KINDS[kind]
  const help =
    kind === 'section' ? copy.sectionHelp : kind === 'template' ? copy.templateHelp : copy.nameHelp

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={copy.body}
      submitLabel={copy.create}
      cancelLabel={copy.cancel}
      submitDisabled={!name.trim()}
      onSubmit={handleSubmit}
      size="lg"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body font-medium text-foreground">{copy.kindLabel}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => {
            const Icon = ICONS[k]
            const selected = k === kind
            return (
              <button
                key={k}
                type="button"
                aria-pressed={selected}
                onClick={() => setKind(k)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-border-strong bg-muted text-foreground'
                    : 'border-border text-foreground hover:bg-muted/60',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex flex-col">
                  <span className="text-body">{copy.kinds[k]}</span>
                  <span className="font-mono text-caption text-muted-foreground">
                    {NEW_FILE_KINDS[k].folder}/ · {NEW_FILE_KINDS[k].ext}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-body font-medium text-foreground">
          {copy.nameLabel}
        </label>
        <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring/50">
          <span className="flex items-center border-r border-input bg-muted px-3 font-mono text-caption text-muted-foreground">
            {folder}/
          </span>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${nameId}-help`}
            autoComplete="off"
            spellCheck={false}
            className="h-full flex-1 rounded-none border-0 shadow-none focus-visible:ring-0"
          />
          <span className="flex items-center border-l border-input bg-muted px-3 font-mono text-caption text-muted-foreground">
            {ext}
          </span>
        </div>
        <p
          id={`${nameId}-help`}
          className={cn('text-caption', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {error ?? help}
        </p>
      </div>
    </FormDialog>
  )
}
