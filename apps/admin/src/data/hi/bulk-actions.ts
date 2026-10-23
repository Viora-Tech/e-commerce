import { bulkActionsContent } from '@/data/bulk-actions'
import { translation } from '@/lib/i18n'

export default [
  translation(bulkActionsContent, {
    summary: (done, failed) =>
      failed === 0 ? `${done} हो गए` : `${done} हो गए, ${failed} नहीं हो पाए`,
  }),
]
