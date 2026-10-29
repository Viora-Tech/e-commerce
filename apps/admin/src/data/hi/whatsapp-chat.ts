import { type WhatsappChatVars, whatsappChatContent } from '@/data/whatsapp-chat'
import { translation } from '@/lib/i18n'

const hi = (name: string | null) => (name ? `नमस्ते ${name}` : 'नमस्ते')
const orderRef = (n: number | null) => (n ? `ऑर्डर #${n}` : 'ऑर्डर')

export default [
  translation(whatsappChatContent, {
    action: 'WhatsApp',
    title: 'WhatsApp पर चैट करें',
    help: 'WhatsApp (ऐप या WhatsApp Web) यह मैसेज लिखा हुआ खोलेगा। वहाँ भेजें दबाने तक कुछ नहीं जाएगा।',
    loading: 'ग्राहक की जानकारी लोड हो रही है',
    failed: 'ग्राहक की जानकारी लोड नहीं हो पाई। थोड़ी देर में फिर कोशिश करें।',
    noPhone: 'चैट करने के लिए कोई फ़ोन नंबर नहीं है।',
    to: 'किसे',
    templateLabel: 'मैसेज',
    messageLabel: 'टेक्स्ट',
    messagePlaceholder: 'अपना मैसेज लिखें',
    cancel: 'रद्द करें',
    open: 'WhatsApp खोलें',
    templates: {
      payment: 'पेमेंट लिंक',
      order_confirmation: 'ऑर्डर कन्फ़र्मेशन',
      shipping_update: 'शिपिंग अपडेट',
      cart_recovery: 'छोड़ा हुआ कार्ट',
      blank: 'खाली',
    },
    messages: {
      payment: (v: WhatsappChatVars) =>
        `${hi(v.customerName)}, हम ${v.storeName} से बात कर रहे हैं। आपका ${orderRef(v.orderNumber)}${v.totalLabel ? ` (${v.totalLabel})` : ''} पेमेंट का इंतज़ार कर रहा है। यहाँ पेमेंट करें: ${v.link ?? ''}`,
      order_confirmation: (v: WhatsappChatVars) =>
        `${hi(v.customerName)}, ${v.storeName} से ${orderRef(v.orderNumber)} करने के लिए धन्यवाद! हमें आपका ऑर्डर मिल गया है, भेजते ही हम आपको बताएँगे।${v.link ? ` अपना ऑर्डर देखें: ${v.link}` : ''}`,
      shipping_update: (v: WhatsappChatVars) =>
        `${hi(v.customerName)}, ${v.storeName} से आपका ${orderRef(v.orderNumber)} रास्ते में है।${v.waybill ? ` ट्रैकिंग नंबर: ${v.waybill}।` : ''}${v.link ? ` यहाँ ट्रैक करें: ${v.link}` : ''}`,
      cart_recovery: (v: WhatsappChatVars) =>
        `${hi(v.customerName)}, आपने ${v.storeName} पर अपने कार्ट में कुछ सामान छोड़ा है। आपका सामान सेव है, यहाँ ऑर्डर पूरा करें: ${v.link ?? ''}`,
      blank: () => '',
    },
  }),
]
