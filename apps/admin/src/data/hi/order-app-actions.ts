import { orderAppActionsContent } from '@/data/order-app-actions'
import { translation } from '@/lib/i18n'

export default [
  translation(orderAppActionsContent, {
    createShipment: 'शिपमेंट बनाएं',
    bulkMenu: 'और कार्रवाइयाँ',
    failed: 'यह नहीं हो पाया। फिर कोशिश करें।',
    gst: {
      issued: (numbers) =>
        numbers.length === 1
          ? `GST इनवॉइस ${numbers[0]} जारी हो गया`
          : `${numbers.length} GST इनवॉइस जारी हुए: ${numbers.join(', ')}`,
      alreadyIssued: (numbers) => `पहले से इनवॉइस बना है: ${numbers.join(', ')}`,
      nothingIssued: 'इस ऑर्डर का कोई इनवॉइस जारी नहीं हुआ।',
      view: 'देखें',
      download: 'डाउनलोड',
      viewAll: 'इनवॉइस देखें',
      openQueue: 'कतार खोलें',
      queued: (c) => {
        const parts = [
          c.added === 0 ? 'इनवॉइस कतार में जोड़ने को कुछ नया नहीं' : `${c.added} इनवॉइस कतार में जोड़े गए`,
        ]
        if (c.alreadyQueued) parts.push(`${c.alreadyQueued} ऑर्डर पहले से कतार में हैं`)
        if (c.alreadyInvoiced) parts.push(`${c.alreadyInvoiced} ऑर्डर का इनवॉइस पहले से बना है`)
        if (c.skipped) {
          parts.push(
            `${c.skipped} ऑर्डर छोड़े गए, इन पर टैक्स इनवॉइस नहीं बनता (टेस्ट, रद्द या सिर्फ़ गिफ़्ट कार्ड)`,
          )
        }
        return `${parts.join('। ')}।`
      },
    },
  }),
]
