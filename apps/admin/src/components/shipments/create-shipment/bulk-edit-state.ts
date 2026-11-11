/** The minimum the bulk edit popup needs to find an order in its batch. */
type BatchOrder = { orderId: string; pickedKey: string | null }

/** Where `orderId` sits in the batch: its index (-1 when absent) and the order itself. */
export function batchPosition<T extends BatchOrder>(
  orders: T[],
  orderId: string | null,
): { index: number; order: T | undefined } {
  const index = orders.findIndex((o) => o.orderId === orderId)
  return { index, order: index >= 0 ? orders[index] : undefined }
}
