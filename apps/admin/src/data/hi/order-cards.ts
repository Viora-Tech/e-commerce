import { parcelsCardContent, profitCardContent } from '@/data/order-cards'
import { translation } from '@/lib/i18n'

export default [
  translation(parcelsCardContent, {
    title: (count) => (count === 1 ? 'कहाँ से जाएगा' : `${count} पार्सल में जाएगा`),
    parcel: (position) => `पार्सल ${position}`,
    from: (place) => `${place} से`,
    billedUnder: (gstin) => `GST ${gstin}`,
    units: (count) => (count === 1 ? '1 सामान' : `${count} सामान`),
    status: {
      open: 'पैक करना है',
      on_hold: 'रुका है (प्री-ऑर्डर)',
      fulfilled: 'पैक हो गया',
      cancelled: 'कैंसिल',
    },
    needsTransfer: 'स्टॉक भेजना है',
    needsTransferHelp: 'ऑर्डर आते समय इस लोकेशन पर पूरा सामान नहीं था। पैक करने से पहले स्टॉक यहाँ भेज दें।',
    packed: (done, of) => `${of} में से ${done} पैक`,
  }),
  translation(profitCardContent, {
    title: 'मुनाफ़ा',
    netSales: 'कुल बिक्री (GST के बिना)',
    goods: 'माल की लागत',
    courier: 'कूरियर खर्च',
    fees: 'पेमेंट फ़ीस',
    rto: 'RTO खर्च',
    profit: 'मुनाफ़ा',
    margin: (percent) => `${percent} मार्जिन`,
    notes: {
      costEstimated: 'कुछ सामान की लागत बिक्री के बाद, उस समय की लागत से भरी गई है।',
      costMissing: 'कुछ सामान की लागत अभी नहीं डाली, इसलिए वह मुफ़्त गिना गया। प्रोडक्ट पर लागत डालें।',
      courierMissing: 'कूरियर का खर्च अभी पता नहीं। नीचे डालें।',
      feeFromRate: 'पेमेंट फ़ीस Settings › Costs for profit में आपकी दरों से है।',
      feeMissing: 'इस पेमेंट तरीके की फ़ीस दर नहीं डाली गई।',
    },
    setRates: 'फ़ीस दरें डालें',
    courierLabel: 'कूरियर खर्च (₹)',
    courierSave: 'सेव करें',
    courierSaved: 'कूरियर खर्च सेव हो गया',
    courierInvalid: 'रुपये में रकम लिखें, जैसे 65 या 65.50।',
    failed: 'सेव नहीं हो सका',
  }),
]
