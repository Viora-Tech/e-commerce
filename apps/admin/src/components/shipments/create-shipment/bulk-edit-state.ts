import { volumetricWeightGrams } from '@commerce/core/parcel'
import { type BulkLine, type OrderEdit, shippingParcel } from './bulk-ship-state'
import type { Dimensions, DraftParcel, ShipmentDraft } from './flow-state'
import { isPartial, plannedParcel } from './partial-plan'

/** The row editor's box choice besides the store's boxes. */
export const OWN_BOX = 'own'
export const CUSTOM_SIZE = 'custom'

/** The row editor (Figma 913:9698) as typed: text fields stay text until applied. */
export type EditForm = {
  boxId: string
  weight: string
  length: string
  width: string
  height: string
  paymentMode: 'cod' | 'prepaid'
  insured: boolean
  /** The courier row picked; null follows the rule. */
  optionKey: string | null
  /** Items to send: how many of each parcel line go now (0 up to what is still to send). */
  counts: Record<string, number>
  /** Tell the customer it ships in parts, when only some go. */
  notify: boolean
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

const sameDims = (a: Dimensions | null | undefined, b: Dimensions | null | undefined) =>
  (a?.length ?? 0) === (b?.length ?? 0) &&
  (a?.width ?? 0) === (b?.width ?? 0) &&
  (a?.height ?? 0) === (b?.height ?? 0)

/** The row editor's starting values for one order: what it books with now. */
export function editForm(
  line: BulkLine,
  edit: OrderEdit | undefined,
  boxes: ShipmentDraft['boxes'],
): EditForm {
  const parcel = line.parcel
  const whole = line.whole?.lines ?? []
  const counts = Object.fromEntries(whole.map((l) => [l.id, edit?.keep?.[l.id] ?? l.quantity]))
  const dims = edit?.dimensionsCm ?? parcel?.dimensionsCm ?? null
  const preset =
    edit?.boxId && edit.boxId !== CUSTOM_SIZE
      ? edit.boxId
      : boxes.find(
          (b) =>
            dims && sameDims(dims, { length: b.lengthCm, width: b.widthCm, height: b.heightCm }),
        )?.id
  const missing = parcel?.lines.some((l) => l.weightGrams === null) ?? false
  return {
    boxId: preset ?? (parcel?.dimensionsCm && !edit?.dimensionsCm ? OWN_BOX : CUSTOM_SIZE),
    weight: text(edit?.weightGrams ?? (missing ? null : parcel?.weightGrams)),
    length: text(dims?.length),
    width: text(dims?.width),
    height: text(dims?.height),
    paymentMode: line.paymentMode,
    insured: line.insured,
    optionKey: edit?.optionKey ?? (line.byHand ? (line.pick?.optionKey ?? null) : null),
    counts,
    notify: edit?.notify ?? true,
  }
}

/** A line's count kept between none and the units it still has to send. */
export const clampCount = (n: number, max: number) =>
  Math.max(0, Math.min(max, Number.isFinite(n) ? Math.round(n) : 0))

/** Units ticked to go now. */
export const pickedUnits = (form: EditForm) => Object.values(form.counts).reduce((n, c) => n + c, 0)

/** Apply needs at least one unit going; with none, "Skip this order" leaves it out instead. */
export const canApply = (form: EditForm) => pickedUnits(form) > 0

/** The parcel as the typed picks would ship it (the whole parcel until some are left out). */
export function formParcel(line: BulkLine, form: EditForm): DraftParcel | null {
  if (!line.whole) return line.parcel
  return shippingParcel(line.whole, { keep: form.counts })
}

/**
 * A line's count changed (the tick or the stepper): clamped to what it still has to send, and,
 * as the order page's partial shipment does (`useSplitPlan.change`), the weight follows the
 * items that go now. A weight typed for a product with none stays until every such item is out.
 */
export function withCount(form: EditForm, line: BulkLine, lineId: string, next: number): EditForm {
  const item = line.whole?.lines.find((l) => l.id === lineId)
  if (!item || !line.whole) return form
  const counts = { ...form.counts, [lineId]: clampCount(next, item.quantity) }
  const after = { ...form, counts }
  if (pickedUnits(after) === 0) return after
  const now = plannedParcel(line.whole, counts)
  if (now.lines.some((l) => l.weightGrams === null)) return after
  return { ...after, weight: String(now.weightGrams) }
}

/** Picking a box fills its size; "Products' own box" puts the parcel's back. */
export function withEditBox(
  form: EditForm,
  boxId: string,
  line: BulkLine,
  boxes: ShipmentDraft['boxes'],
): EditForm {
  const box = boxes.find((b) => b.id === boxId)
  const dims = box
    ? { length: box.lengthCm, width: box.widthCm, height: box.heightCm }
    : boxId === OWN_BOX
      ? line.parcel?.dimensionsCm
      : null
  if (!dims) return { ...form, boxId }
  return {
    ...form,
    boxId,
    length: text(dims.length),
    width: text(dims.width),
    height: text(dims.height),
  }
}

const positive = (s: string): number | null => {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

/**
 * What the row editor applies: only what differs from the order's own package and payment, so an
 * untouched order keeps booking exactly as it did. Insurance is always kept: the batch switch
 * may change, the order's own choice should not.
 */
export function formToEdit(form: EditForm, line: BulkLine, before?: OrderEdit): OrderEdit {
  const parcel = formParcel(line, form)
  const partial = line.whole !== null && isPartial(line.whole.lines, form.counts)
  const weight = positive(form.weight)
  const [l, w, h] = [positive(form.length), positive(form.width), positive(form.height)]
  const dims = l !== null && w !== null && h !== null ? { length: l, width: w, height: h } : null
  const out: OrderEdit = { insured: form.insured }
  const missing = parcel?.lines.some((x) => x.weightGrams === null) ?? false
  if (weight !== null && (missing || weight !== parcel?.weightGrams || before?.weightGrams)) {
    out.weightGrams = Math.round(weight)
  }
  if (dims && !sameDims(dims, parcel?.dimensionsCm)) {
    out.dimensionsCm = dims
    out.boxId = form.boxId === OWN_BOX ? CUSTOM_SIZE : form.boxId
  }
  if (form.paymentMode !== line.order.paymentMode) out.paymentMode = form.paymentMode
  if (form.optionKey) out.optionKey = form.optionKey
  if (partial) {
    out.keep = { ...form.counts }
    out.notify = form.notify
  }
  return out
}

/** The charged weight the couriers will bill, from the typed package: the bigger of the real
 *  weight and the box's volumetric weight; null until a weight is typed. */
export function typedChargedGrams(form: EditForm): number | null {
  const weight = positive(form.weight)
  if (weight === null) return null
  const [l, w, h] = [positive(form.length), positive(form.width), positive(form.height)]
  const volumetric =
    l !== null && w !== null && h !== null
      ? volumetricWeightGrams({ lengthCm: l, widthCm: w, heightCm: h })
      : 0
  return Math.round(Math.max(weight, volumetric))
}

const sameEditDims = (a: Dimensions | undefined, b: Dimensions | undefined) =>
  a === b || (a !== undefined && b !== undefined && sameDims(a, b))

/** The row editor changed what the couriers price (weight, size, payment or the items sent): ask them again. */
export function repriced(before: OrderEdit | undefined, after: OrderEdit): boolean {
  return (
    (before?.weightGrams ?? null) !== (after.weightGrams ?? null) ||
    !sameEditDims(before?.dimensionsCm, after.dimensionsCm) ||
    (before?.paymentMode ?? null) !== (after.paymentMode ?? null) ||
    JSON.stringify(before?.keep ?? null) !== JSON.stringify(after.keep ?? null)
  )
}
