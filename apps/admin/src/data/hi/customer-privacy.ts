import { customerPrivacyContent } from '@/data/customer-privacy'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(customerPrivacyContent, {
    title: untranslated,
    subtitle: untranslated,
    save: untranslated,
    saved: untranslated,
    failed: untranslated,
    loadFailed: untranslated,
    banner: {
      heading: 'कुकी बैनर',
      body: 'चुनें कि किन ग्राहकों से analytics और marketing कुकीज़ के बारे में पूछा जाए। जहाँ बैनर पूछता है, वहाँ हाँ कहने तक कुछ भी वैकल्पिक नहीं चलता, जैसे स्टोर analytics, Google टैग और Meta pixel।',
      regions: {
        label: 'बैनर किसे दिखे',
        help: 'Shopify की तरह: विज़िटर उस देश से पहचाने जाते हैं जहाँ से वे ब्राउज़ कर रहे हैं।',
        options: {
          consent_required: {
            title: 'सिर्फ़ जहाँ सहमति ज़रूरी है (सुझाया गया)',
            body: 'EU, EEA, UK और स्विट्ज़रलैंड के विज़िटर को बैनर दिखता है और पहले पूछा जाता है। बाकी सभी, भारत समेत, पहले पेज से बिना बैनर के ट्रैक होते हैं, और फ़ुटर की Cookie settings से ट्रैकिंग बंद कर सकते हैं।',
          },
          everyone: {
            title: 'सबसे पूछें',
            body: 'हर विज़िटर को बैनर दिखता है, और हाँ कहने तक कुछ भी वैकल्पिक नहीं चलता।',
          },
        },
      },
      message: untranslated,
      messageHelp: untranslated,
      messagePlaceholder: untranslated,
      version: untranslated,
      askAgain: untranslated,
      askAgainHelp: untranslated,
      askAgainConfirmTitle: untranslated,
      askAgainConfirmBody: untranslated,
      askAgainConfirm: untranslated,
      askedAgain: untranslated,
      stats: untranslated,
    },
    requests: untranslated,
    grievance: untranslated,
    accounts: untranslated,
  }),
]
