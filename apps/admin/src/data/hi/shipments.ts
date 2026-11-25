import {
  shipmentActionsContent,
  shipmentCancelContent,
  shipmentPartsContent,
} from '@/data/shipments'
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
    cancelPickup: 'पिकअप रद्द करें',
    cancelPickupTitle: (n) => `${n} पार्सल पिकअप से हटाएं?`,
    cancelPickupBody:
      'लेबल चालू रहते हैं और पार्सल अपने पिकअप और मैनिफ़ेस्ट से हटकर वापस Booked में जाते हैं। Delhivery पिकअप आपके गोदाम के लिए बुक करता है, हर पार्सल के लिए नहीं: उनका कर्मचारी फिर भी इन्हें ले जा सकता है। अगर कोई पार्सल नहीं जाना चाहिए तो शिपमेंट रद्द करें।',
    cancelPickupDone: (n) => `${n} पार्सल वापस Booked में हैं।`,
    cancelPickupSome: (done, failed) =>
      `${done} वापस Booked में; ${failed} पिकअप से नहीं हटे (शायद पहले ही ले जाए गए)।`,
    pickupByCourierSkipped: (n, courier) =>
      `${n} पार्सल छोड़ दिए गए: ${courier} बुक करते समय अपना पिकअप खुद शेड्यूल करता है। पिकअप रोकने के लिए शिपमेंट रद्द करें।`,
    refreshTracking: 'ट्रैकिंग अपडेट करें',
    trackingUpdated: 'ट्रैकिंग अपडेट हो गई',
    failed: 'कूरियर तक रिक्वेस्ट नहीं पहुंची। थोड़ी देर में फिर कोशिश करें।',
    pickupRefused: 'कूरियर ने पिकअप रिक्वेस्ट नहीं ली। फिर कोशिश करें, या उनके डैशबोर्ड पर बुक करें।',
    pickupStaysBooked: 'पार्सल Booked में ही रहते हैं। दिक्कत ठीक करें, फिर पिकअप बनाएं दोबारा आज़माएं।',
  }),
  translation(shipmentCancelContent, {
    menu: 'रद्द करें…',
    title: (awb) => `AWB ${awb} का क्या करें?`,
    back: 'पिकअप रद्द करें',
    backHelp:
      'लेबल चालू रहता है। पार्सल इस पिकअप और मैनिफ़ेस्ट से हटकर वापस Booked में जाता है, ताकि आप इसे किसी और दिन के पिकअप में डाल सकें।',
    shipment: 'शिपमेंट रद्द करें',
    shipmentHelp:
      'कूरियर यह AWB रद्द करता है। आइटम पैक ही रहते हैं और ऑर्डर वापस To ship में जाता है, किसी भी कूरियर से फिर बुक करने के लिए।',
    sendBack: 'रद्द करें और वापस मंगाएं',
    sendBackHelp:
      'पार्सल कूरियर के पास है। उनसे रद्द करने को कहा जाता है, जिससे पार्सल आपके पास लौटता है। यह Returned (RTO) में चला जाता है।',
    marked: 'कूरियर के ऐप पर पहले ही रद्द किया',
    markedHelp:
      'कूरियर को कुछ नहीं भेजा जाता। शिपमेंट यहाँ रद्द माना जाता है और ऑर्डर वापस To ship में जाता है।',
    noCourierCancel:
      'यह कूरियर यहाँ से रद्द करना नहीं लेता। कूरियर की साइट पर रद्द करें, फिर आखिरी विकल्प चुनें।',
    pickupByCourier: (courier) =>
      `${courier} बुक करते समय अपना पिकअप खुद शेड्यूल करता है। पिकअप रोकने के लिए शिपमेंट रद्द करें।`,
    confirm: 'पक्का करें',
    keep: 'जैसा है रहने दें',
    backDone: 'पिकअप रद्द हो गया। पार्सल वापस Booked में है।',
    shipmentDone: 'शिपमेंट रद्द हो गया। ऑर्डर वापस To ship में है।',
    sendBackDone: 'कूरियर से वापस लाने को कहा गया। यह Returned (RTO) में है।',
    markedDone: 'रद्द मान लिया गया। ऑर्डर वापस To ship में है।',
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
