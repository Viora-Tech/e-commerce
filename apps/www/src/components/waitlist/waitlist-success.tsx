'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { waitlistContent as copy } from '@/data/waitlist'
import ShareLinkField from './share-link-field'

type WaitlistSuccessProps = { onDone: () => void }

export default function WaitlistSuccess({ onDone }: WaitlistSuccessProps) {
  return (
    <div className="flex flex-col gap-5">
      <span className="grid size-12 place-items-center rounded-full bg-foreground text-background">
        <CheckIcon aria-hidden className="size-5" />
      </span>
      <div>
        <DialogTitle className="text-2xl font-semibold text-foreground">
          {copy.success.title}
        </DialogTitle>
        <DialogDescription className="mt-1 text-muted-foreground">
          {copy.success.body}
        </DialogDescription>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-eyebrow">{copy.success.nextTitle}</p>
        <ol className="flex flex-col gap-3">
          {copy.success.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-foreground">
                {index + 1}
              </span>
              <div className="text-sm">
                <p className="font-semibold text-foreground">{step.title}</p>
                <p className="text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ShareLinkField />
      <Button variant="outline" size="lg" onClick={onDone}>
        {copy.success.done}
      </Button>
    </div>
  )
}
