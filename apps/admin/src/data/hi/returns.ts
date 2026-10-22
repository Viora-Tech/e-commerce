import { returnListActionsContent } from '@/data/returns'
import { translation } from '@/lib/i18n'

export default [
  translation(returnListActionsContent, {
    approve: 'मंज़ूर करें',
    approveSelected: (n) => `${n} मंज़ूर करें`,
    approveTitle: (n) => (n === 1 ? 'यह रिटर्न मंज़ूर करें?' : `${n} रिटर्न मंज़ूर करें?`),
    approveBody:
      'हर ग्राहक को ईमेल मिलेगा कि उसका रिटर्न मंज़ूर हो गया है। सामान कैसे वापस आएगा (कूरियर पिकअप या ग्राहक खुद भेजे), यह हर रिटर्न के पेज पर चुनें।',
    close: 'रिटर्न बंद करें',
    closeSelected: (n) => `${n} बंद करें`,
    closeTitle: (n) => (n === 1 ? 'यह रिटर्न बिना रिफ़ंड के बंद करें?' : `${n} रिटर्न बिना रिफ़ंड के बंद करें?`),
    closeBody:
      'बंद करने पर रिटर्न बिना रिफ़ंड, स्टोर क्रेडिट या एक्सचेंज के निपट जाता है। सिर्फ़ वही रिटर्न बंद होंगे जो आपके पास आ चुके हैं, बाकी छोड़ दिए जाएंगे।',
    summary: (done, skipped, failed) =>
      [
        `${done} रिटर्न अपडेट हुए`,
        skipped > 0 ? `${skipped} छोड़े गए` : null,
        failed > 0 ? `${failed} नहीं हो पाए` : null,
      ]
        .filter(Boolean)
        .join(', '),
  }),
]
