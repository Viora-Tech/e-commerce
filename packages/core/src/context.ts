import type { StoreTx } from '@commerce/db'

export type StoreContext = {
  storeId: string
  tx: StoreTx
}
