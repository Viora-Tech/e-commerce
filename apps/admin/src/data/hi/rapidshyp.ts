import { rapidshypAppContent } from '@/data/rapidshyp'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(rapidshypAppContent, {
    connect: untranslated,
    overview: {
      title: untranslated,
      subtitle: untranslated,
      notConnected: untranslated,
      connectCta: untranslated,
      connected: untranslated,
      connectedAndTested: untranslated,
      goToShipments: untranslated,
      goToShipmentsHelp: untranslated,
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN कोड पर डिलीवरी होती है या नहीं, अनुमानित डिलीवरी तारीख के साथ',
        rates: 'RapidShyp के कूरियर नेटवर्क में दाम और डिलीवरी के दिन मिलाएं',
        create_shipment: 'सबसे अच्छे उपलब्ध कूरियर से शिपमेंट बुक करें, लेबल और पिकअप के साथ',
        label: 'कूरियर लेबल PDF में छापें',
        tracking: 'शिपमेंट ट्रैक करें (तय समय पर जाँचा जाता है, RapidShyp का वेबहुक नहीं है)',
        cancel: 'बुक किया ऑर्डर रद्द करें',
        ndr: 'नाकाम डिलीवरी को दोबारा करवाएं, पता बदलें या वापस भेजें',
        reverse_pickup: 'ग्राहक के रिटर्न के लिए कूरियर पिकअप बुक करें',
        pickup_at_booking: 'पार्सल बुक होते ही RapidShyp पिकअप शेड्यूल करता है',
        pickup: 'अगर बुकिंग पर RapidShyp ने पिकअप नहीं लिया, तो पिकअप बनाएं से फिर माँगें',
      },
      notYetSupported: untranslated,
      notYetSupportedItems: untranslated,
      copied: untranslated,
    },
  }),
]
