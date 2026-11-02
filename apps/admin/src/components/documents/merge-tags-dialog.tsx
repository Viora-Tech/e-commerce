'use client'

import { Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { documentTemplatesContent } from '@/data/document-templates'
import { useCopy } from '@/hooks/use-copy'

type MergeTagsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The tags this document takes, e.g. `{{ order.number }}` or `{{#lines}} … {{/lines}}: title`. */
  tags: readonly string[]
}

/** The tag itself, without the ": title, sku" note on a repeating block. */
function tagOf(entry: string): string {
  return entry.split(':')[0]?.trim() ?? entry
}

/** The fields a repeating block offers ("title, variant, sku"), or null for a plain tag. */
function fieldsOf(entry: string): string | null {
  const i = entry.indexOf(':')
  return i === -1 ? null : entry.slice(i + 1).trim()
}

/** Every merge tag a printed document takes, each with a Copy button (#106). */
export default function MergeTagsDialog({ open, onOpenChange, tags }: MergeTagsDialogProps) {
  // Hooks
  const { mergeTags: copy } = useCopy(documentTemplatesContent)

  // Event handlers
  const handleCopy = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag)
      toast.success(copy.copied(tag))
    } catch {
      toast.error(copy.copyFailed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[60dvh] flex-col overflow-y-auto">
          {tags.map((entry) => {
            const tag = tagOf(entry)
            const fields = fieldsOf(entry)
            return (
              <li
                key={entry}
                className="flex items-center gap-3 border-b border-hairline py-2 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <code className="font-mono text-caption break-all text-ink-strong">{tag}</code>
                  {fields ? (
                    <span className="text-caption text-muted-foreground">
                      {copy.fields(fields)}
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.copy(tag)}
                  onClick={() => handleCopy(tag)}
                >
                  <Copy aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
