import { gstNumberPickerContent } from '@/data/gst-invoices'
import { translation } from '@/lib/i18n'

export default [
  translation(gstNumberPickerContent, {
    label: 'GST नंबर',
    all: 'सभी GST नंबर',
    option: (state: string, gstin: string) => `${state} · ${gstin}`,
    main: '(मुख्य)',
    cancelled: '(रद्द)',
  }),
]
