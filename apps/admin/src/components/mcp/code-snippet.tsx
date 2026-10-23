import { cn } from '@commerce/ui/lib/utils'
import CopyButton from '@/components/fields/copy-button'

type CodeSnippetProps = {
  value: string
  /** What is being copied, for the button's label and toast: "Command", "Config". */
  what: string
  /** A small grey label above the code ("With a token"). */
  label?: string
  className?: string
}

/** A command or config block with a copy button, for the connect guide. */
export default function CodeSnippet({ value, what, label, className }: CodeSnippetProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? <span className="text-caption text-muted-foreground">{label}</span> : null}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 py-2 pr-2 pl-3">
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-caption leading-5 whitespace-pre text-ink-strong">
          {value}
        </pre>
        <CopyButton value={value} what={what} visible />
      </div>
    </div>
  )
}
