import { deliveryRouteCardContent, parcelsCardContent, profitCardContent } from '@/data/order-cards'
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
    packing: 'पैकिंग',
    courier: 'डिलीवरी',
    fees: 'पेमेंट फ़ीस',
    rto: 'RTO खर्च',
    profit: 'मुनाफ़ा',
    margin: (percent) => `${percent} मार्जिन`,
    notes: {
      costEstimated: 'कुछ सामान की लागत बिक्री के बाद, उस समय की लागत से भरी गई है।',
      costMissing: 'कुछ सामान की लागत अभी नहीं डाली, इसलिए वह मुफ़्त गिना गया। प्रोडक्ट पर लागत डालें।',
      courierMissing: 'कूरियर का खर्च अभी पता नहीं। नीचे डालें।',
      courierEstimated:
        'कूरियर का असली खर्च आने तक डिलीवरी अंदाज़न है (60 दिन में इस राज्य का आपका सबसे ऊँचा खर्च, वरना आपका डिफ़ॉल्ट)। पता चलने पर नीचे डालें।',
      packingEstimated: 'पैकिंग आज की डिब्बे की कीमत है; पार्सल बुक होने पर तय हो जाती है।',
      packingMissing:
        'आपके डिब्बे की कीमत नहीं डाली, इसलिए पैकिंग शून्य गिनी गई। Settings › Shipping में डालें।',
      feeFromRate:
        'जब तक Razorpay या Cashfree असली फ़ीस नहीं बताता, पेमेंट फ़ीस Settings › Costs for profit में आपकी दरों से अंदाज़न है।',
      feeMissing: 'इस पेमेंट तरीके की फ़ीस दर नहीं डाली गई।',
    },
    feeSource: {
      actual: 'असली',
      estimated: 'अंदाज़न',
      mixed: 'कुछ अंदाज़न',
    },
    feeSourceHelp: {
      actual: 'Razorpay या Cashfree ने इस पेमेंट के लिए जो फ़ीस बताई।',
      estimated: 'आपकी दरों से, जब तक गेटवे असली फ़ीस नहीं बताता।',
      mixed: 'कुछ फ़ीस असली है, बाकी आपकी दरों से जब तक गेटवे नहीं बताता।',
    },
    setRates: 'फ़ीस दरें डालें',
    estimatedTag: 'अंदाज़न',
    estimatedDetail: 'अंदाज़न',
    atLeast: (amount) => `कम से कम ${amount}`,
    floor: 'आपके डाले गए खर्चों के हिसाब से। कुछ खर्च अलग निकले तो असली मुनाफ़ा थोड़ा ज़्यादा या कम हो सकता है।',
    courierLabel: 'कूरियर खर्च (₹)',
    courierSave: 'सेव करें',
    courierSaved: 'कूरियर खर्च सेव हो गया',
    courierInvalid: 'रुपये में रकम लिखें, जैसे 65 या 65.50।',
    failed: 'सेव नहीं हो सका',
  }),
  translation(deliveryRouteCardContent, {
    title: 'डिलीवरी विकल्प',
    via: (service, app) => `${app} से ${service}`,
    insured: 'बीमा है',
    promised: (range) => `वादा ${range}`,
    backupTag: 'बैकअप पर लिया गया',
    backupHelp:
      'चेकआउट पर कूरियर ने जवाब नहीं दिया, इसलिए इस ऑर्डर पर आपका ज़ोन रेट लगा और कोई रूट सेव नहीं हुआ। अपने कूरियर नियमों से बुक करें; प्रोडक्ट रूट नियम फिर भी लागू होते हैं।',
    charged: 'लिया गया शिपिंग',
    courier: 'कूरियर',
    courierFrom: {
      booking: 'बुकिंग से',
      quote: 'चेकआउट का कोट',
    },
    insurance: 'बीमा',
    margin: 'शिपिंग मार्जिन',
    marginUnknown: 'पार्सल बुक होने और कूरियर खर्च पता चलने पर मार्जिन दिखेगा।',
  }),
]
