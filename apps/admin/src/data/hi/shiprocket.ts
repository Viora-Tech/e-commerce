import { shiprocketAppContent } from '@/data/shiprocket'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(shiprocketAppContent, {
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
        rates: 'Shiprocket के कूरियर नेटवर्क में दाम और डिलीवरी के दिन मिलाएं',
        create_shipment: 'सबसे अच्छे उपलब्ध कूरियर से शिपमेंट बुक करें और AWB पाएं',
        pickup_at_booking: 'पार्सल बुक होते ही Shiprocket से पिकअप माँगें',
        pickup: 'अगर बुकिंग पर Shiprocket ने पिकअप नहीं लिया, तो पिकअप बनाएं से फिर माँगें',
        label: 'शिपिंग लेबल छापें',
        tracking: 'दिन में कुछ बार स्कैन अपने-आप ट्रैक करें',
        webhook: 'वेबहुक चालू करने पर लगभग तुरंत ट्रैकिंग अपडेट पाएं',
        ndr: 'NDR सूची से दोबारा डिलीवरी करवाएं या पता बदलें',
        wallet: 'अपना लाइव Shiprocket वॉलेट बैलेंस देखें और कम बैलेंस पर अलर्ट पाएं',
        reverse_pickup: 'ग्राहक के रिटर्न के लिए कूरियर पिकअप बुक करें',
      },
      webhookUrlLabel: untranslated,
      webhookWhere: untranslated,
      webhookUrlHelp: untranslated,
      copied: untranslated,
    },
  }),
]
