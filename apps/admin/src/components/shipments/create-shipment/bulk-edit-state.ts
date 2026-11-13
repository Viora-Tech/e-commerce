import { volumetricWeightGrams } from '@commerce/core/parcel'
import type { BulkLine, OrderEdit } from './bulk-ship-state'
import type { Dimensions, ShipmentDraft } from './flow-state'

/** The minimum the bulk edit popup needs to find an order in its batch. */
type BatchOrder = { orderId: string }

/** Where `orderId` sits in the batch: its index (-1 when absent) and the order itself. */
export function batchPosition<T extends BatchOrder>(
  orders: T[],
  orderId: string | null,
): { index: number; order: T | undefined } {
  const index = orders.findIndex((o) => o.orderId === orderId)
  return { index, order: index >= 0 ? orders[index] : undefined }
}

/** The Edit popup's box choice besides the store's boxes. */
export const OWN_BOX = 'own'
export const CUSTOM_SIZE = 'custom'

/** The Edit popup (Figma 913:9698) as typed: text fields stay text until saved. */
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
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

const sameDims = (a: Dimensions | null | undefined, b: Dimensions | null | undefined) =>
  (a?.length ?? 0) === (b?.length ?? 0) &&
  (a?.width ?? 0) === (b?.width ?? 0) &&
  (a?.height ?? 0) === (b?.height ?? 0)

/** The popup's starting values for one order: what it books with now. */
export function editForm(
  line: BulkLine,
  edit: OrderEdit | undefined,
  boxes: ShipmentDraft['boxes'],
): EditForm {
  const parcel = line.parcel
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
  }
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
 * What the popup saves: only what differs from the order's own package and payment, so an
 * untouched order keeps booking exactly as it did. Insurance is always kept: the batch switch
 * may change, the order's own choice should not.
 */
export function formToEdit(form: EditForm, line: BulkLine, before?: OrderEdit): OrderEdit {
  const parcel = line.parcel
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

/** The popup changed what the couriers price (weight, size or payment): ask them again. */
export function repriced(before: OrderEdit | undefined, after: OrderEdit): boolean {
  return (
    (before?.weightGrams ?? null) !== (after.weightGrams ?? null) ||
    !sameEditDims(before?.dimensionsCm, after.dimensionsCm) ||
    (before?.paymentMode ?? null) !== (after.paymentMode ?? null)
  )
}

/** `batchPosition` over the drawer's lines (each keyed by its order). */
export function linePosition(
  lines: readonly BulkLine[],
  orderId: string | null,
): { index: number; line: BulkLine | undefined } {
  const index = lines.findIndex((l) => l.order.orderId === orderId)
  return { index, line: index >= 0 ? lines[index] : undefined }
}
