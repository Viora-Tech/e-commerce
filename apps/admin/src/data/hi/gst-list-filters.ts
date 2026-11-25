import { gstListFiltersContent } from '@/data/gst-list-filters'
import { translation } from '@/lib/i18n'

export default [
  translation(gstListFiltersContent, {
    queueResource: { singular: 'कतार का ऑर्डर', plural: 'कतार के ऑर्डर' },
    invoiceResource: { singular: 'दस्तावेज़', plural: 'दस्तावेज़' },
    presets: {
      this_month: 'इस महीने',
      last_month: 'पिछले महीने',
      '7d': 'पिछले 7 दिन',
      '30d': 'पिछले 30 दिन',
      '90d': 'पिछले 90 दिन',
    },
    filters: {
      due: 'ऑर्डर की तारीख',
      invoiceDate: 'इनवॉइस की तारीख',
      gstin: 'GST नंबर',
      gstOption: (state, gstin) => (state ? `${state}, ${gstin}` : gstin),
      anyGstin: 'कोई भी GST नंबर',
      payment: 'भुगतान',
      payments: { prepaid: 'प्रीपेड', cod: 'कैश ऑन डिलीवरी' },
      anyPayment: 'कोई भी भुगतान',
      source: 'स्रोत',
      sources: { koomerce: 'यहाँ जारी', external: 'बाहर का दर्ज' },
      anySource: 'कोई भी स्रोत',
      status: 'स्थिति',
      statuses: { issued: 'जारी', cancelled: 'रद्द' },
      anyStatus: 'कोई भी स्थिति',
    },
    sort: {
      orderNumber: 'ऑर्डर नंबर',
      dueDate: 'ऑर्डर की तारीख',
      invoiceNumber: 'इनवॉइस नंबर',
      invoiceDate: 'इनवॉइस की तारीख',
      amount: 'रकम',
      oldest: { asc: 'पुराने पहले', desc: 'नए पहले' },
      lowest: { asc: 'कम पहले', desc: 'ज़्यादा पहले' },
    },
    dateColumn: 'तारीख',
    issueSelected: (n) => `${n} इनवॉइस जारी करें`,
    noneReadySelected: 'चुने गए ऑर्डर में से कोई जारी करने को तैयार नहीं है',
  }),
]
