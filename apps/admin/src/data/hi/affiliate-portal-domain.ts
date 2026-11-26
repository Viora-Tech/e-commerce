import { affiliatePortalDomainContent } from '@/data/affiliate-portal-domain'
import { translation } from '@/lib/i18n'

export default [
  translation(affiliatePortalDomainContent, {
    title: 'पोर्टल का पता',
    description: 'जहाँ आपके एफ़िलिएट साइन इन करते हैं, अपनी बिक्री देखते हैं और अपने लिंक पाते हैं।',
    current: 'एफ़िलिएट इस्तेमाल करते हैं',
    fallbackNote: 'पोर्टल का पता जोड़ने के बाद भी यह पता चलता रहेगा।',
    use: (host: string) => `${host} इस्तेमाल करें`,
    useHelp: (host: string) =>
      `पोर्टल को उसका अपना पता दें, ${host}। जहाँ आपका डोमेन रजिस्टर है वहाँ दो DNS रिकॉर्ड जोड़ें, फिर Verify दबाएँ।`,
    connected: (host: string) => `${host} जोड़ा गया। दो DNS रिकॉर्ड जोड़ें, फिर Verify दबाएँ।`,
    verify: 'Verify',
    verified: 'पोर्टल का पता जुड़ गया',
    stillPending: 'रिकॉर्ड अभी नहीं मिले। हम जाँचते रहेंगे।',
    pending: 'दो DNS रिकॉर्ड का इंतज़ार है। हम हर कुछ मिनट में जाँचते हैं।',
    failed: 'जो रिकॉर्ड मिले वे मेल नहीं खाते। जहाँ डोमेन रजिस्टर है वहाँ ठीक करें, फिर दोबारा जाँचें।',
    sslPending: 'रिकॉर्ड मिल गए। मुफ़्त SSL सर्टिफ़िकेट बन रहा है; इसमें कुछ मिनट लगते हैं।',
    live: (url: string) => `एफ़िलिएट अब ${url} इस्तेमाल करते हैं`,
    liveHelp: 'आपके स्टोर पर /affiliate के लिंक उन्हें यहीं भेजते हैं।',
    copyWhat: 'पोर्टल का पता',
    manage: 'डोमेन सेटिंग्स',
    disconnect: 'हटाएँ',
    disconnectTitle: (host: string) => `${host} हटाएँ?`,
    disconnectBody:
      'एफ़िलिएट तुरंत आपके स्टोर के /affiliate पर लौट जाएँगे। बाद में दोनों DNS रिकॉर्ड हटा दें।',
    disconnectConfirm: 'हटाएँ',
    disconnected: (host: string) => `${host} हटाया गया`,
    noDomain: {
      heading: 'पहले अपना डोमेन जोड़ें',
      body: 'पोर्टल का पता आपके स्टोर के अपने डोमेन के नीचे होता है, जैसे affiliate.yourbrand.in। Settings › Domains में डोमेन जोड़ें और उसे मुख्य डोमेन बनाएँ।',
      action: 'Domains पर जाएँ',
    },
    noAccess: 'इसे बदलने के लिए Settings › Domains की अनुमति चाहिए। स्टोर के मालिक से पूछें।',
    actionFailed: 'पोर्टल का पता अपडेट नहीं हो सका',
    loadFailed: 'पोर्टल का पता लोड नहीं हो सका',
    retry: 'फिर से कोशिश करें',
  }),
]
