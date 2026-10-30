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
      queued: (added, skipped) => {
        const done =
          added === 0 ? 'इनवॉइस कतार में जोड़ने को कुछ नया नहीं' : `${added} इनवॉइस कतार में जोड़े गए`
        return skipped === 0
          ? done
          : `${done}। ${skipped} टेस्ट या सिर्फ़ गिफ़्ट कार्ड वाले ऑर्डर छोड़े गए, इन पर टैक्स इनवॉइस नहीं बनता।`
      },
    },
  }),
]
