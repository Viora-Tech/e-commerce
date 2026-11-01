import {
  returnCustomReasonsContent,
  returnListActionsContent,
  returnRulesContent,
} from '@/data/returns'
import { translation } from '@/lib/i18n'

export default [
  translation(returnCustomReasonsContent, {
    title: 'आपकी अपनी वजहें',
    description: 'अपने शब्दों में वजहें जोड़ें। ग्राहक इन्हें ऊपर वाली वजहों के बाद देखेंगे।',
    label: 'नई वजह',
    placeholder: 'जैसे: यह बहुत देर से पहुंचा',
    add: 'जोड़ें',
    remove: (reason) => `"${reason}" हटाएं`,
    duplicate: 'यह वजह पहले से है।',
    limit: (max) => `आप ज़्यादा से ज़्यादा ${max} वजहें जोड़ सकते हैं।`,
  }),
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
  translation(returnRulesContent, {
    exchangesTitle: 'एक्सचेंज',
    exchanges: 'ग्राहकों को दूसरा साइज़ या रंग मांगने दें',
    exchangesHint:
      'रिटर्न फ़ॉर्म पर वे पैसे वापस लेने की जगह अपनी पसंद का वेरिएंट चुन सकते हैं। पार्सल वापस आने पर आप उसे रिटर्न के पेज से भेजें।',
    autoTitle: 'रिटर्न अपने आप मंज़ूर करें',
    autoDescription:
      'जो रिक्वेस्ट इन नियमों से मेल खाती हैं, वे तुरंत मंज़ूर हो जाती हैं। पिकअप और पार्सल की जांच आप ही करते हैं।',
    auto: 'मेल खाने वाली रिक्वेस्ट अपने आप मंज़ूर करें',
    autoReasons: 'इन कारणों के लिए',
    autoMax: 'इतनी कीमत तक',
    autoMaxHint: 'रुपये में। 0 का मतलब कोई भी कीमत।',
    wants: {
      refund: 'पैसे वापस चाहिए',
      exchange: 'एक्सचेंज चाहिए',
      store_credit: 'स्टोर क्रेडिट चाहिए',
    },
    swapTo: (from, to) => `${from} की जगह ${to}`,
    autoApproved: 'आपके रिटर्न नियमों से अपने आप मंज़ूर',
  }),
]
