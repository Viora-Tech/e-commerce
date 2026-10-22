'use client'

import { Package } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { returnDetailContent } from '@/data/returns'
import { api } from '@/lib/api-client'
import type { ReturnDetail } from './return-types'

type RestockButtonProps = { detail: ReturnDetail; onChanged: () => void }

const copy = returnDetailContent.restock

/** One click: the return's items go back in stock. Shows a quiet note once they are. */
export default function RestockButton({ detail: r, onChanged }: RestockButtonProps) {
  // Hooks
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRestock = async () => {
    setBusy(true)
    try {
      const out = await api.returns.restock({ id: r.id })
      toast.success(copy.done(out.moved))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (r.restockedAt) return <span className="text-caption text-success">{copy.already}</span>

  return (
    <Button variant="outline" onClick={handleRestock} disabled={busy}>
      <Package aria-hidden="true" />
      {copy.button}
    </Button>
  )
}
