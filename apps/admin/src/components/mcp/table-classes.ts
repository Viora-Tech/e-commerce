import { cn } from '@commerce/ui/lib/utils'
import { SETTINGS_CELL } from '@/components/settings/settings-table'

/** Table head and cell classes for the tables that run edge to edge in a settings card. */
export const MCP_HEAD =
  'h-10 border-b border-line bg-card px-3 py-0 text-caption font-medium text-muted-foreground first:pl-6 last:pr-6'
export const MCP_CELL = cn(SETTINGS_CELL, 'first:pl-6 last:pr-6')
