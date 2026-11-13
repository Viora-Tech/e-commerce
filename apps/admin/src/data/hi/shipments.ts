import { shipmentActionsContent, shipmentPartsContent } from '@/data/shipments'
import { translation } from '@/lib/i18n'

export default [
  translation(shipmentActionsContent, {
    schedulePickup: 'पिकअप बनाएं',
    pickupTitle: (n) => `${n} पार्सल के लिए पिकअप बनाएं`,
    pickupBody:
      'कूरियर से इन पार्सल को आपके चुने दिन और समय पर ले जाने को कहा जाएगा, सौंपने के लिए मैनिफ़ेस्ट बनेगा, और ये "पिकअप होना है" में चले जाएंगे।',
    pickupAndManifestDone: (n) => `${n} पार्सल के लिए पिकअप माँगा गया। इसका मैनिफ़ेस्ट Pickups में है।`,
    date: 'पिकअप की तारीख',
    timeFrom: 'कब से (24 घंटे, जैसे 14:00)',
    timeTo: 'कब तक (वैकल्पिक)',
    joinPickup: (courier, when, n) => `${courier} पिकअप में जोड़ें · ${when} · इसमें ${n} पार्सल`,
    newPickup: 'नया पिकअप',
    addToPickup: 'पिकअप में जोड़ें',
    joinedDone: (n) => `${n} पार्सल पिकअप में जुड़ गए। इसका मैनिफ़ेस्ट Pickups में है।`,
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
  translation(shipmentPartsContent, {
    part: (n, of) => `${of} में से हिस्सा ${n}`,
    shipped: (n, date) => `हिस्सा ${n} ${date} को भेजा`,
    item: (title, quantity) => `${title} × ${quantity}`,
    waiting: {
      preorder: (date) => (date ? `इंतज़ार · प्री-ऑर्डर ${date}` : 'इंतज़ार · प्री-ऑर्डर'),
      stock: (date) => (date ? `इंतज़ार · स्टॉक ${date}` : 'इंतज़ार · स्टॉक'),
    },
  }),
]
