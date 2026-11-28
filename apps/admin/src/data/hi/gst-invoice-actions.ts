import { gstInvoiceActionsContent } from '@/data/gst-invoice-actions'
import { translation } from '@/lib/i18n'

export default [
  translation(gstInvoiceActionsContent, {
    detail: {
      email: 'खरीदार को ईमेल करें',
      noEmail: 'इस ऑर्डर में कोई ईमेल पता नहीं है',
      sending: 'इनवॉइस ईमेल हो रहा है',
      sent: (email) => `इनवॉइस ${email} पर ईमेल हुआ`,
      queued: 'इनवॉइस खरीदार को भेजा जा रहा है',
      failed: 'इनवॉइस ईमेल नहीं हो सका',
      more: 'और कार्रवाइयाँ',
    },
    bulk: {
      more: 'और कार्रवाइयाँ',
    },
  }),
]
