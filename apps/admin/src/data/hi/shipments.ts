import { shipmentActionsContent } from '@/data/shipments'
import { translation } from '@/lib/i18n'

export default [
  translation(shipmentActionsContent, {
    schedulePickup: 'पिकअप शेड्यूल करें',
    pickupTitle: (n) => `${n} पार्सल के लिए पिकअप शेड्यूल करें`,
    pickupBody: 'कूरियर ये बुक किए गए पार्सल आपके चुने दिन और समय पर ले जाएगा।',
    date: 'पिकअप की तारीख',
    timeFrom: 'कब से (24 घंटे, जैसे 14:00)',
    timeTo: 'कब तक (वैकल्पिक)',
    pickupDone: (n) => `${n} पार्सल के लिए पिकअप शेड्यूल हो गया`,
    createManifest: 'मैनिफ़ेस्ट बनाएं',
    manifestTitle: (n) => `${n} पार्सल के लिए मैनिफ़ेस्ट बनाएं?`,
    manifestBody:
      'मैनिफ़ेस्ट इन पार्सल को एक लेबल शीट में जोड़ता है, जिसे आप पिकअप वाले को देते हैं। यह आपको Pickups में मिलेगा।',
    manifestDone: 'मैनिफ़ेस्ट बन गया। यह आपको Pickups में मिलेगा।',
    refreshTracking: 'ट्रैकिंग अपडेट करें',
    trackingUpdated: 'ट्रैकिंग अपडेट हो गई',
    failed: 'कूरियर तक रिक्वेस्ट नहीं पहुंची। थोड़ी देर में फिर कोशिश करें।',
  }),
]
