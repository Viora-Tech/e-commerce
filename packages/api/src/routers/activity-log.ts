import {
  listStoreActivity,
  listStoreActivityPeople,
  permissions,
  StoreActivityQuerySchema,
} from '@commerce/core'
import { can } from '../procedures'

/**
 * Settings → Activity log: every change members made to the store, newest first, filtered by
 * person, area, source, words and dates. Read with `activity.read` (owners and administrators).
 */
export const activityLogRouter = {
  /** Changes members made to the store, newest first, one page at a time, with the total. */
  list: can(permissions.ACTIVITY_READ)
    .input(StoreActivityQuerySchema)
    .handler(({ context, input }) =>
      listStoreActivity({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),

  /** Everyone who appears in the log, for the Person filter. */
  listPeople: can(permissions.ACTIVITY_READ).handler(({ context }) =>
    listStoreActivityPeople({ tx: context.tx, storeId: context.scope.storeId }),
  ),
}
