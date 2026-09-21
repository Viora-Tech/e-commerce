'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import { DataCard } from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import { api } from '@/lib/api-client'
import type { OrderDetail } from './order-detail-types'

type CustomerCardProps = {
  order: OrderDetail
}

/** Who ordered and where it goes. */
export function CustomerCard({ order }: CustomerCardProps) {
  const a = order.shippingAddress

  return (
    <DataCard title={copy.customer.heading}>
      <div className="flex flex-col gap-4 text-body">
        <div>
          <p className="font-medium">{order.customer?.name ?? copy.customer.guest}</p>
          {order.email ? (
            <a
              href={`mailto:${order.email}`}
              className="block text-primary hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {order.email}
            </a>
          ) : null}
          {order.phone ? (
            <a
              href={`tel:${order.phone}`}
              className="block text-primary hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {order.phone}
            </a>
          ) : null}
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-caption mb-1">{copy.customer.address}</p>
          {a ? (
            <address className="not-italic">
              <p>{a.name}</p>
              <p>{a.line1}</p>
              {a.line2 ? <p>{a.line2}</p> : null}
              <p>
                {a.city}, {a.stateCode} {a.pincode}
              </p>
              {a.phone ? <p>{a.phone}</p> : null}
            </address>
          ) : (
            <p className="text-muted-foreground">{copy.customer.noAddress}</p>
          )}
          <p className="text-caption mt-2">{copy.customer.billingSame}</p>
        </div>
      </div>
    </DataCard>
  )
}

type TagsCardProps = {
  orderId: string
  tags: string[]
  onChanged: () => void
}

/** Free-form labels for filtering later; saved on every add/remove. */
export function TagsCard({ orderId, tags, onChanged }: TagsCardProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(next: string[]) {
    setSaving(true)
    try {
      await api.orders.setTags({ id: orderId, tags: next })
      toast.success(copy.tags.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const tag = draft.trim()
    if (!tag || tags.includes(tag)) return
    setDraft('')
    void save([...tags, tag])
  }

  return (
    <DataCard title={copy.tags.heading} className="print:hidden">
      <div className="flex flex-col gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-[12px] text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => save(tags.filter((x) => x !== t))}
                  disabled={saving}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${t}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={copy.tags.placeholder}
          disabled={saving}
        />
      </div>
    </DataCard>
  )
}
