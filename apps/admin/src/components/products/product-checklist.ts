import type { ChecklistItem } from '@/components/layout/page-checklist'
import type { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import type { Formatters } from '@/lib/format'
import { type FormErrors, type ProductFormState, stockOf } from './form-state'
import { type ProductTabId, tabOfError, tabsFor } from './product-tab-list'

type Copy = typeof productFormContent

/** One "On this page" row per tab: done, needs fixing, or not filled in yet, with a short note. */
export function productChecklist(
  copy: Copy,
  fmt: Formatters,
  form: ProductFormState,
  errors: FormErrors,
  single: boolean,
): ChecklistItem[] {
  const c = copy.checklist
  const broken = new Set<ProductTabId>(
    (Object.keys(errors) as (keyof FormErrors)[]).map((key) => tabOfError(key, single)),
  )
  const first = form.variants[0]

  const row = (id: ProductTabId): Omit<ChecklistItem, 'id' | 'label'> => {
    if (broken.has(id)) return { state: 'warn', note: c.fix }
    switch (id) {
      case 'overview':
        return form.media.length > 0
          ? { state: 'done', note: c.photos(form.media.length) }
          : { state: 'todo', note: c.noPhotos }
      case 'price': {
        const paise = first ? rupees.toPaise(first.price) : null
        return paise == null
          ? { state: 'todo' }
          : { state: 'done', note: `${fmt.money(paise)} · ${fmt.number(stockOf(form.variants))}` }
      }
      case 'variants':
        return { state: 'done', note: fmt.number(form.variants.length) }
      case 'shipping':
        if (form.variants.some((v) => !v.weight.trim())) return { state: 'todo', note: c.noWeight }
        /* GST invoices print the HSN code, so a product without one needs fixing. */
        if (form.variants.some((v) => !v.hsCode.trim())) return { state: 'warn', note: c.noHsCode }
        return { state: 'done' }
      case 'seo':
        return form.seoTitle.trim() || form.seoDescription.trim()
          ? { state: 'done', note: c.custom }
          : { state: 'todo', note: c.auto }
      case 'more':
        return form.preorderEnabled ? { state: 'done', note: c.preorderOn } : { state: 'todo' }
    }
  }

  return tabsFor(single).map((id) => ({ id, label: copy.tabs.labels[id], ...row(id) }))
}
