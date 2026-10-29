import { loadActivityFeed, permissions } from '@commerce/core'
import { canAny } from '../procedures'

/**
 * The top bar's activity bell. Any member who may read orders, stock or files gets in; the
 * feed then shows each part only with its own permission (`loadActivityFeed` checks each).
 */
export const activityRouter = {
  feed: canAny([
    permissions.ORDERS_READ,
    permissions.INVENTORY_READ,
    permissions.CONTENT_READ,
  ]).handler(({ context }) =>
    loadActivityFeed(
      context.tx,
      context.scope.storeId,
      context.scope.can,
      context.session.user.id,
    ),
  ),
}
