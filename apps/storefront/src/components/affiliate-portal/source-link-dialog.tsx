'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { referralLink } from '@/lib/portal-format'
import CopyField from './copy-field'

type SourceLinkDialogProps = { origin: string; code: string }

const copy = affiliatePortalContent.dashboard.link

/** "Get link with source": their link with `utm_source`, to tell their posts apart. */
export default function SourceLinkDialog({ origin, code }: SourceLinkDialogProps) {
  // Hooks
  const [source, setSource] = useState('')

  // Render logic
  const link = source.trim() ? referralLink(origin, '/', code, source) : null
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus />
        {copy.source}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>{copy.source}</DialogTitle>
          <DialogDescription>{copy.sourceHint}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="portal-link-source">{copy.sourceLabel}</Label>
          <Input
            id="portal-link-source"
            value={source}
            maxLength={40}
            autoCapitalize="none"
            placeholder={copy.sourcePlaceholder}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        {link ? <CopyField value={link} label={copy.source} /> : null}
      </DialogContent>
    </Dialog>
  )
}
