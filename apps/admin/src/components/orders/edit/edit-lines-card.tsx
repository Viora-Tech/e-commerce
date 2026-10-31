'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DraftCustomItemDialog from '@/components/drafts/draft-custom-item-dialog'
import type { DraftLine } from '@/components/drafts/draft-form-state'
import DataCard from '@/components/layout/data-card'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import type { OrderDetail } from '../order-detail-types'
import EditAddSearch from './edit-add-search'
import EditLineDiscountDialog, { type DiscountTarget } from './edit-line-discount-dialog'
import EditLineRow from './edit-line-row'
import EditNewRow from './edit-new-row'
import {
  type CustomLine,
  type EditState,
  lineName,
  priceOf,
  quantityOf,
  restocks,
  type VariantResult,
} from './edit-state'

type EditLinesCardProps = {
  order: OrderDetail
  state: EditState
  onChange: (patch: Partial<EditState>) => void
}

/** Which line "Add discount" is open on: one already on the order, an added one or a custom one. */
type Discounting = DiscountTarget & { apply: (unitPricePaise: number) => void }

/**
 * The order's items as they would be: change quantities and prices, remove (with restock), undo,
 * give a line a discount, and add catalogue or custom items.
 */
export default function EditLinesCard({ order, state, onChange }: EditLinesCardProps) {
  // Hooks
  const copy = useCopy(orderEditContent)
  const [addingCustom, setAddingCustom] = useState(false)
  const [discounting, setDiscounting] = useState<Discounting | null>(null)

  // Helpers
  const patchCustom = (key: string, patch: Partial<CustomLine>) =>
    onChange({ custom: state.custom.map((c) => (c.key === key ? { ...c, ...patch } : c)) })
  const patchAdded = (variantId: string, patch: { quantity?: number; unitPricePaise?: number }) =>
    onChange({
      added: state.added.map((a) => (a.variantId === variantId ? { ...a, ...patch } : a)),
    })

  // Event handlers
  const handleQuantity = (lineId: string, quantity: number) => {
    onChange({ quantities: { ...state.quantities, [lineId]: quantity } })
  }
  const handlePrice = (lineId: string, unitPricePaise: number) => {
    onChange({ prices: { ...state.prices, [lineId]: unitPricePaise } })
  }
  const handleRestock = (lineId: string, restock: boolean) => {
    onChange({ restock: { ...state.restock, [lineId]: restock } })
  }
  const handleAdd = (v: VariantResult) => {
    const existing = state.added.find((a) => a.variantId === v.variantId)
    onChange({
      added: existing
        ? state.added.map((a) =>
            a.variantId === v.variantId ? { ...a, quantity: a.quantity + 1 } : a,
          )
        : [
            ...state.added,
            {
              variantId: v.variantId,
              title: v.title,
              variantTitle: v.variantTitle,
              sku: v.sku,
              imageUrl: v.imageUrl,
              quantity: 1,
              // No price yet (#913): starts at nothing for the merchant to type one in.
              unitPricePaise: v.pricePaise ?? 0,
            },
          ],
    })
  }
  /* The draft editor's "Add custom item" dialog (same fields), kept as an edit's custom line. */
  const handleAddCustom = (line: DraftLine) => {
    onChange({
      custom: [
        ...state.custom,
        {
          key: line.key,
          title: line.title,
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
          taxable: line.custom?.taxable ?? true,
          hsCode: line.custom?.hsCode ?? '',
        },
      ],
    })
  }

  // Render logic
  return (
    <DataCard
      title={copy.items}
      bodyClassName="flex flex-col gap-4"
      action={
        <Button variant="outline" size="sm" onClick={() => setAddingCustom(true)}>
          <Plus aria-hidden="true" />
          {copy.addCustom}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {order.lines.map((l) => (
          <EditLineRow
            key={l.id}
            line={l}
            quantity={quantityOf(state, l)}
            unitPricePaise={priceOf(state, l)}
            restock={restocks(state, l)}
            onQuantity={(q) => handleQuantity(l.id, q)}
            onPrice={(p) => handlePrice(l.id, p)}
            onRestock={(r) => handleRestock(l.id, r)}
            onDiscount={() =>
              setDiscounting({
                name: lineName(l.title, l.variantTitle),
                unitPricePaise: priceOf(state, l),
                apply: (p) => handlePrice(l.id, p),
              })
            }
          />
        ))}
        {state.added.map((a) => (
          <EditNewRow
            key={a.variantId}
            title={lineName(a.title, a.variantTitle)}
            imageUrl={a.imageUrl}
            quantity={a.quantity}
            unitPricePaise={a.unitPricePaise}
            onChange={(patch) => patchAdded(a.variantId, patch)}
            onRemove={() =>
              onChange({ added: state.added.filter((x) => x.variantId !== a.variantId) })
            }
            onDiscount={() =>
              setDiscounting({
                name: lineName(a.title, a.variantTitle),
                unitPricePaise: a.unitPricePaise,
                apply: (p) => patchAdded(a.variantId, { unitPricePaise: p }),
              })
            }
          />
        ))}
        {state.custom.map((c) => (
          <EditNewRow
            key={c.key}
            title={c.title}
            imageUrl={null}
            custom
            quantity={c.quantity}
            unitPricePaise={c.unitPricePaise}
            onChange={(patch) => patchCustom(c.key, patch)}
            onRemove={() => onChange({ custom: state.custom.filter((x) => x.key !== c.key) })}
            onDiscount={() =>
              setDiscounting({
                name: c.title,
                unitPricePaise: c.unitPricePaise,
                apply: (p) => patchCustom(c.key, { unitPricePaise: p }),
              })
            }
          />
        ))}
      </ul>
      <EditAddSearch onAdd={handleAdd} />
      <DraftCustomItemDialog
        open={addingCustom}
        onOpenChange={setAddingCustom}
        onAdd={handleAddCustom}
      />
      <EditLineDiscountDialog
        target={discounting}
        onClose={() => setDiscounting(null)}
        onApply={(p) => discounting?.apply(p)}
      />
    </DataCard>
  )
}
