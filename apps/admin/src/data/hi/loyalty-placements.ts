import { loyaltyPlacementsContent } from '@/data/loyalty-placements'
import { translation } from '@/lib/i18n'

export default [
  translation(loyaltyPlacementsContent, {
    title: 'जगहें',
    subtitle: 'आपके स्टोर पर मेंबर अपने पॉइंट कहाँ देखते हैं। हर एक को अपनी थीम में चालू करें।',
    items: {
      widget: {
        title: 'तैरता विजेट',
        body: 'हर पेज के कोने में एक बटन जो पॉइंट, इनाम और कमाने के तरीके खोलता है।',
      },
      productPoints: {
        title: 'प्रोडक्ट पेज पर पॉइंट',
        body: 'कीमत के नीचे दिखाता है कि प्रोडक्ट पर कितने पॉइंट मिलेंगे।',
      },
      cardPoints: {
        title: 'प्रोडक्ट कार्ड पर पॉइंट',
        body: 'कलेक्शन और खोज में प्रोडक्ट कार्ड पर पॉइंट की छोटी लाइन।',
      },
      cartRedeem: {
        title: 'कार्ट में इस्तेमाल',
        body: 'मेंबर कार्ट से ही पॉइंट किसी इनाम पर खर्च कर सकते हैं।',
      },
      referralPopup: {
        title: 'रेफ़रल पॉप-अप',
        body: 'रेफ़रल लिंक खोलने वाले दोस्त का स्वागत करता है और उसका इनाम दिखाता है।',
      },
    },
    where: {
      embed: 'ऑनलाइन स्टोर › कस्टमाइज़ › ऐप एम्बेड',
      block: 'ऑनलाइन स्टोर › कस्टमाइज़ › टेम्पलेट में ऐप ब्लॉक जोड़ें',
    },
    open: 'कस्टमाइज़ खोलें',
    status: { ready: 'तैयार', off: 'बंद', unknown: 'ऐप ब्लॉक' },
    noTheme: 'अभी कोई लाइव थीम नहीं। विजेट लगाने के लिए एक थीम पब्लिश करें।',
    loadFailed: 'आपकी थीम लोड नहीं हुई',
  }),
]
