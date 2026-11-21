import { homeSectionsContent } from '@/data/home-sections'
import { translation } from '@/lib/i18n'

export default [
  translation(homeSectionsContent, {
    needsYou: {
      title: 'आपके काम',
      jobs: (n) => `${n} काम`,
      oldestWaiting: (n) => `सबसे पुराना ${n} दिन से रुका`,
      oldest: (n) => `सबसे पुराना ${n} दिन`,
      outOfStock: (n) => `${n} का स्टॉक खत्म`,
    },
    health: {
      toFix: (n) => `${n} ठीक करने हैं`,
    },
    oldOrders: {
      lead: (n) => `${n} ऑर्डर 30 दिन से पुराने हैं और अभी भी "भेजना बाकी" दिखा रहे हैं।`,
      body: 'Koomerce के बाहर भेज दिए? उन्हें मार्क करें ताकि वे गिने न जाएं।',
      cta: 'कहीं और से भेजे गए मार्क करें',
    },
    doing: {
      period: (n, from, to, beforeFrom, beforeTo) =>
        `पिछले ${n} दिन (${from} – ${to}), उससे पहले के ${n} दिनों (${beforeFrom} – ${beforeTo}) के मुकाबले`,
      periodNoBefore: (n, from, to) => `पिछले ${n} दिन (${from} – ${to})`,
      whatChanged: 'क्या बदला',
      salesLead: (n, amount) => `पिछले ${n} दिनों की बिक्री: ${amount},`,
      salesUp: (pct, before, n) => `उससे पहले के ${n} दिनों के ${before} से ${pct} ज़्यादा।`,
      salesDown: (pct, before, n) => `उससे पहले के ${n} दिनों के ${before} से ${pct} कम।`,
      salesFlat: (before, n) => `उससे पहले के ${n} दिनों के ${before} जितनी ही।`,
      salesNoBefore: 'अभी तुलना के लिए पिछला डेटा नहीं है।',
      bestLead: (n) => `पिछले ${n} दिनों में बिक्री के हिसाब से सबसे आगे:`,
      best: (title, amount) => `${title}, ${amount}।`,
      mostUnits: (title, units) => `सबसे ज़्यादा पीस बिके: ${title}, ${units}।`,
      lowStockLead: (n) => `${n} प्रोडक्ट`,
      lowStock: () => 'का स्टॉक अभी कम है।',
      streakLead: 'हर दिन बिक्री हुई',
      streak: (n) => `पिछले ${n} दिनों से।`,
      noData: 'कुछ दिनों के ऑर्डर आने के बाद यहाँ दिखेगा कि क्या बदला।',
    },
    paymentMethods: {
      upi: 'UPI',
      card: 'कार्ड',
      netbanking: 'नेटबैंकिंग',
      wallet: 'वॉलेट',
      emi: 'EMI',
      pay_later: 'बाद में पेमेंट',
      cod: 'कैश ऑन डिलीवरी',
      store_credit: 'स्टोर क्रेडिट',
      gift_card: 'गिफ़्ट कार्ड',
      online: 'ऑनलाइन पेमेंट',
      other: 'अन्य',
    },
    goal: {
      noGoal: 'कोई टारगेट नहीं रखा।',
      suggested: (lastMonth, target) =>
        `कोई टारगेट नहीं रखा। पिछले महीने आपकी बिक्री ${lastMonth} थी, तो ${target} एक अच्छा टारगेट होगा।`,
    },
  }),
]
