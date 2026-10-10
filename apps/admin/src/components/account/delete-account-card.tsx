'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DeleteAccountDialog from './delete-account-dialog'

type Deletion = Awaited<ReturnType<typeof api.account.deletion>>

/**
 * Profile's danger zone: "Delete my account", blocked with the reason while the member owns a
 * store (a store always keeps its owner).
 */
export default function DeleteAccountCard() {
  // Hooks
  const {
    profile: { danger: copy },
  } = useCopy(accountContent)
  const [deletion, setDeletion] = useState<Deletion | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api.account
      .deletion()
      .then(setDeletion)
      .catch(() => setDeletion(null))
  }, [])

  // Render logic
  const owned = deletion?.ownedStores ?? []

  return (
    <SettingsCard
      id="delete-account"
      title={copy.heading}
      description={copy.body}
      className="border border-destructive/30"
    >
      <div className="flex flex-col items-start gap-3">
        {owned.length > 0 ? (
          <p className="text-body text-muted-foreground">{copy.blocked(owned.join(', '))}</p>
        ) : null}
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
          disabled={!deletion || owned.length > 0}
        >
          {copy.button}
        </Button>
      </div>
      {deletion ? (
        <DeleteAccountDialog open={open} email={deletion.email} onOpenChange={setOpen} />
      ) : null}
    </SettingsCard>
  )
}
