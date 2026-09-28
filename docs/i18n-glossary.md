# Hindi glossary for the admin

Plain everyday Hindi, the way an Indian shop owner talks, not formal or Sanskritised. Keep the
English word (in Latin script) where that is what merchants actually say. Use the same word
for the same thing on every page.

## Keep in English (Latin script)

COD, GST, GSTIN, CGST/SGST/IGST, SKU, UPI, QR, OTP, HSN, AWB, NDR, RTO, EMI, API, URL, SEO,
CSV, PDF, ID, Razorpay, Cashfree, Delhivery, Shiprocket, Shopify, WhatsApp, Instagram,
Amazon, Flipkart, Meesho, Google, pincode (write "पिनकोड" only in running text, never in
field names that already say "Pincode"), Settings (as the page name), Admin.

## Say it this way (Devanagari)

| English | Hindi |
| --- | --- |
| order / orders | ऑर्डर |
| product / products | प्रोडक्ट |
| variant | वेरिएंट |
| collection | कलेक्शन |
| customer | ग्राहक |
| payment | पेमेंट |
| paid / unpaid | पेमेंट हो गया / पेमेंट बाकी |
| refund | रिफ़ंड |
| shipping | शिपिंग |
| delivery / delivered | डिलीवरी / डिलीवर हो गया |
| courier | कूरियर |
| shipment | शिपमेंट |
| fulfil / fulfilled / unfulfilled | भेजें / भेज दिया / भेजना बाकी |
| cancel / cancelled | कैंसिल करें / कैंसिल |
| return | रिटर्न |
| stock / in stock / out of stock | स्टॉक / स्टॉक में / स्टॉक खत्म |
| inventory | इन्वेंटरी |
| price / sale price | कीमत / सेल कीमत |
| discount | डिस्काउंट |
| tax | टैक्स |
| invoice | इनवॉइस |
| sales | बिक्री |
| store / shop | स्टोर / दुकान |
| draft | ड्राफ़्ट |
| tag / tags | टैग |
| save / saved | सेव करें / सेव हो गया |
| discard | रद्द करें |
| edit | बदलें |
| delete | हटाएं |
| add | जोड़ें |
| search | खोजें |
| filter | फ़िल्टर |
| export / import | एक्सपोर्ट / इंपोर्ट |
| settings | Settings (page name) / सेटिंग |
| upload | अपलोड |
| image / media | फ़ोटो / मीडिया |
| weight | वज़न |
| address | पता |
| phone | फ़ोन |
| email | ईमेल |
| note | नोट |
| today / yesterday | आज / कल |
| Could not … | … नहीं हो पाया |
| Try again | फिर कोशिश करें |
| Loading… | लोड हो रहा है… |

## Style

- Short, friendly, "आप" form. Buttons are verbs: "सेव करें", "ऑर्डर बनाएं".
- Keep numbers, ₹ amounts, placeholders like `{n}` and brand names as they are.
- Plurals: Hindi nouns barely change, so `(n) => n === 1 ? '1 order' : \`${n} orders\`` usually
  becomes `(n) => \`${n} ऑर्डर\``. Keep the function; change only what it returns.
- No em or en dashes (— –) in copy; use a comma, full stop or "से" instead.
- Ellipsis "…" stays.
