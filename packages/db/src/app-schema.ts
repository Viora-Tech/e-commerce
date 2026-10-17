import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/**
 * One row per app a store has installed: when and by whom, what the app last did and the last
 * failure it recorded. The install list itself stays in `store.apps.installed` (registries read
 * it); this table is the Installed apps page's history. Deleted on uninstall, so a reinstall
 * starts fresh. `installed_by` is the staff user, null for apps installed before this table or
 * connected straight from Settings. A row may also appear without an install date when an app
 * installed earlier records its first activity.
 */
export const appInstallation = pgTable(
  'app_installation',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    pluginId: text('plugin_id').notNull(),
    /** Null for an app installed before this table existed: its install date was never kept. */
    installedAt: timestamp('installed_at', { withTimezone: true }),
    installedBy: text('installed_by'),
    /** What the app last did, in its own words ("Issued invoice INV-2041"); null when it said nothing. */
    lastActivity: text('last_activity'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    /** The last failure, in words ("Delhivery refused the API token"); cleared by the next success. */
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('app_installation_store_plugin').on(t.storeId, t.pluginId)],
)
