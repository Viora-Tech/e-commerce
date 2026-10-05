import { bugReportContent } from '@/data/bug-report'
import { translation } from '@/lib/i18n'

export default [
  translation(bugReportContent, {
    open: 'गड़बड़ी बताएं',
    title: 'गड़बड़ी बताएं',
    intro: 'बताइए क्या गलत हुआ। हम आपका यह पेज और हाल की गड़बड़ियां भी साथ भेजते हैं।',
    summaryLabel: 'क्या गलत हुआ?',
    summaryPlaceholder: 'जैसे: Save कुछ नहीं करता',
    detailsLabel: 'उससे ठीक पहले आप क्या कर रहे थे?',
    detailsPlaceholder: 'ज़रूरी नहीं। कदम बताएंगे तो हम इसे दोबारा देख पाएंगे।',
    screenshotLabel: 'इस पेज का स्क्रीनशॉट साथ भेजें',
    screenshotHelp: 'इसमें स्टोर की जानकारी दिख सकती है। यह सिर्फ हमारी टीम को जाता है।',
    screenshotAlt: 'पेज का स्क्रीनशॉट जो भेजा जाएगा',
    screenshotFailed: 'स्क्रीनशॉट नहीं लिया जा सका। आप फिर भी रिपोर्ट भेज सकते हैं।',
    cancel: 'रद्द करें',
    send: 'भेजें',
    sending: 'भेज रहे हैं',
    sent: (n) => `धन्यवाद, #${n} के रूप में दर्ज हो गया`,
    view: 'देखें',
    logged: 'धन्यवाद। सर्वर लॉग में सेव हो गया (इस सर्वर पर GitHub टोकन नहीं है)।',
    failed: 'रिपोर्ट नहीं भेजी जा सकी। एक मिनट बाद फिर कोशिश करें।',
  }),
]
