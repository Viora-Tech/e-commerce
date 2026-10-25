import { staffInvitesContent } from '@/data/staff-invites'
import { translation } from '@/lib/i18n'

export default [
  translation(staffInvitesContent, {
    heading: 'बाकी इनवाइट',
    intro: 'जिन लोगों को आपने इनवाइट किया है पर वे अभी जुड़े नहीं हैं। इनवाइट 2 दिन तक चलता है।',
    empty: 'कोई इनवाइट बाकी नहीं है। किसी को इनवाइट करेंगे तो वे जुड़ने तक यहाँ दिखेंगे।',
    columns: {
      person: 'ईमेल',
      role: 'रोल',
      sent: 'भेजा गया',
      expires: 'खत्म होगा',
    },
    invitedBy: (email) => `${email} ने इनवाइट किया`,
    defaultRole: 'Staff',
    expired: 'खत्म हो गया',
    actions: {
      menu: 'इनवाइट के विकल्प',
      copy: 'इनवाइट लिंक कॉपी करें',
      resend: 'ईमेल दोबारा भेजें',
      resendShort: 'दोबारा भेजें',
      cancel: 'इनवाइट रद्द करें',
    },
    copied: 'इनवाइट लिंक कॉपी हो गया। इसे खुद उन्हें भेज दें।',
    copyFailed: 'लिंक कॉपी नहीं हो सका',
    resent: (email) => `${email} को इनवाइट दोबारा भेजा गया`,
    cancelled: 'इनवाइट रद्द हो गया',
    emailFailed: 'इनवाइट ईमेल नहीं भेजा जा सका',
    emailFailedHelp:
      'इनवाइट "बाकी इनवाइट" में सेव है। उसका लिंक कॉपी करके खुद भेजें, या थोड़ी देर बाद "ईमेल दोबारा भेजें" दबाएँ।',
    failed: 'कुछ गड़बड़ हुई। कृपया फिर से कोशिश करें।',
    loadFailed: 'बाकी इनवाइट लोड नहीं हो सके',
    confirmCancel: {
      title: 'यह इनवाइट रद्द करें?',
      body: (email) => `${email} को भेजा गया लिंक तुरंत काम करना बंद कर देगा।`,
      confirm: 'इनवाइट रद्द करें',
      keep: 'इनवाइट रखें',
    },
  }),
]
