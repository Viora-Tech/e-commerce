import { reviewToolsContent } from '@/data/review-tools'
import { translation } from '@/lib/i18n'

export default [
  translation(reviewToolsContent, {
    channel: {
      label: 'रिक्वेस्ट भेजें',
      options: { email: 'ईमेल', whatsapp: 'WhatsApp', both: 'ईमेल और WhatsApp' },
      whatsappHelp:
        'WhatsApp पर आपके मंज़ूर टेम्पलेट review_request और review_reminder जाते हैं, जिनमें {{1}}, {{2}} और {{3}} की जगह ग्राहक का नाम, स्टोर का नाम और रिव्यू लिंक आता है। जिन ऑर्डर में फ़ोन नंबर नहीं है, उन्हें WhatsApp पर कुछ नहीं जाता।',
    },
  }),
]
