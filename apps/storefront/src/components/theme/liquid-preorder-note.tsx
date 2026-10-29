'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type LiquidPreorderNoteProps = {
  /** The note per pre-order variant, keyed by the id the theme writes (numeric) and its UUID. */
  notes: Record<string, string>
}

const SLOT_ATTR = 'data-commerce-preorder-note'

type Placement = { slot: HTMLElement; variantId: string }

/**
 * The theme's product form (`/cart/add`) while its `id` field holds a pre-order variant of this
 * product; null otherwise (another variant, or our own theme), which shows no note.
 */
function productForm(notes: Record<string, string>): HTMLFormElement | null {
  const forms = document.querySelectorAll<HTMLFormElement>('form[action*="/cart/add"]')
  for (const form of forms) {
    const field = form.querySelector<HTMLInputElement | HTMLSelectElement>('[name="id"]')
    if (field && Object.hasOwn(notes, field.value)) return form
  }
  return null
}

/** The slot right after the form, made once; a re-rendered theme section gets a new one. */
function slotAfter(form: HTMLFormElement): HTMLElement {
  const next = form.nextElementSibling
  if (next instanceof HTMLElement && next.hasAttribute(SLOT_ATTR)) return next
  const slot = document.createElement('div')
  slot.setAttribute(SLOT_ATTR, '')
  form.after(slot)
  return slot
}

/**
 * The pre-order note (#936) under an imported Shopify theme's buy button, where Shopify's
 * pre-order apps (Essential Pre-Order) print it from their app embed, which does not run here.
 * It follows the variant the theme's picker writes into the form's `id` field, so a variant that
 * is not on pre-order shows no note. Renders nothing on our own themes (no `/cart/add` form).
 */
export default function LiquidPreorderNote({ notes }: LiquidPreorderNoteProps) {
  // Hooks
  const [placement, setPlacement] = useState<Placement | null>(null)
  useEffect(() => {
    const sync = () => {
      const form = productForm(notes)
      const field = form?.querySelector<HTMLInputElement | HTMLSelectElement>('[name="id"]')
      if (!form || !field) {
        setPlacement(null)
        return
      }
      const slot = slotAfter(form)
      setPlacement((held) =>
        held?.slot === slot && held.variantId === field.value
          ? held
          : { slot, variantId: field.value },
      )
    }
    sync()
    // Pickers set the field's value by script (no event) or swap the whole section.
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value'],
    })
    document.addEventListener('change', sync, true)
    document.addEventListener('input', sync, true)
    const timer = window.setInterval(sync, 1000)
    return () => {
      observer.disconnect()
      document.removeEventListener('change', sync, true)
      document.removeEventListener('input', sync, true)
      window.clearInterval(timer)
    }
  }, [notes])

  // Early returns
  const note = placement ? notes[placement.variantId] : undefined
  if (!placement || !note) return null

  return createPortal(
    <p className="mt-3 text-[0.875rem] leading-normal whitespace-pre-line opacity-80">{note}</p>,
    placement.slot,
  )
}
