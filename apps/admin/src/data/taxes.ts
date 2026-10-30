/**
 * Copy for the Tax rules and Invoice numbers tabs of Settings › Taxes & GST (the page title and
 * tabs are in `settingsContent.taxesPage`). Plain words: most merchants are not tax experts.
 */
export const taxesContent = {
  loadFailed: 'Could not load your tax settings.',
  saved: 'Tax settings saved',
  failed: 'Could not save tax settings',
  unsaved: 'Unsaved changes',
  save: 'Save',
  discard: 'Discard',

  registration: {
    heading: 'GST registration',
    help: 'Only needed if your business is registered for GST. If it is not, leave this empty.',
    gstin: 'GSTIN',
    gstinHelp:
      'Your 15-character GST number, like 06AAACW1234A1Z5. It is printed on your invoices.',
    registeredIn: (state: string) => `Registered in ${state}`,
    managed: 'Your default GST number. Add or change them under GST numbers.',
    manage: 'Manage GST numbers',
    legalName: 'Registered legal name',
    legalNameHelp: 'The name on your GST certificate. It can differ from your shop name.',
    addressHeading: 'Registered address',
    addressHelp: 'The address on your GST certificate. Printed on invoices.',
    line1: 'Address line 1',
    line2: 'Address line 2 (optional)',
    city: 'City',
    pincode: 'PIN code',
  },

  charging: {
    heading: 'How you charge GST',
    help: 'This decides the GST on every order. You can still set a different rate on any product.',
    composition: 'I am on the composition scheme',
    compositionHelp:
      'Small businesses on this scheme pay a flat tax themselves and do not charge GST to customers. Your invoices will say "Composition taxable person, not eligible to collect tax on supplies".',
    compositionOn:
      'No GST is added to your orders or shown to customers while this is on. Your invoices become "Bill of Supply".',
    pricesInclude: 'My prices include GST',
    pricesIncludeHelp:
      'On: the price you type is what the customer pays, and GST is inside it. This is the usual way in India.',
    pricesExcludeNote:
      'Adding GST on top of your prices at checkout is not built yet. Until it is, customers pay the price you type and GST is worked out from inside it, the same as when this is on.',
    rate: 'Default GST rate',
    rateHelp:
      'Used for products that do not have their own rate. Since 22 September 2025 most goods are 5% or 18%.',
    rateLabel: (rate: number) => `${rate}%`,
    hsn: 'Default HSN code',
    hsnHelp:
      'The goods code printed on invoices for products without their own. 4 digits up to ₹5 crore turnover, 6 above. Example: 8471 for computers and accessories.',
    perProduct: 'To set a different rate or HSN code for one product, open it in Products.',
  },

  numbering: {
    heading: 'Invoice numbers',
    help: 'How your tax invoices are numbered. GST needs every number to be used once, in order.',
    prefix: 'Starts with',
    prefixHelp: 'Letters, numbers, / and -. Write {FY} where you want the year, like INV/{FY}/.',
    next: 'Next number',
    nextHelp: (lowest: number) =>
      lowest > 1
        ? `Numbers below ${lowest} are already used, so start at ${lowest} or higher.`
        : 'Moving from another system? Start where your old invoices stopped.',
    reset: 'Start again at 1 every April',
    resetHelp:
      'A new financial year starts on 1 April. Most shops restart their count then, and put the year in the number so it stays unique.',
    preview: (sample: string) => `Your next invoice will be ${sample}`,
    appMissing:
      'Numbered GST invoices come from the GST invoices app. Install it to start issuing them.',
    openApp: 'Open GST invoices',
    goToApps: 'Go to Apps',
    moreSeries:
      'Separate numbers for exports, credit notes or business buyers are in the GST invoices app.',
  },

  einvoice: {
    heading: 'E-invoicing (IRN)',
    badge: 'Not built yet',
    body: 'Businesses with more than ₹5 crore turnover must send B2B invoices to the government portal for an IRN and QR code. We do not do that for you yet, so if this applies to you, create those on the e-invoice portal for now.',
  },

  explainer: {
    heading: 'How GST works here',
    help: 'A quick guide. Your accountant can confirm what applies to you.',
    items: [
      {
        title: 'Inside your state: CGST + SGST',
        body: 'When you ship to a customer in the same state as your GST registration, the tax is split in half: CGST goes to the central government and SGST to your state.',
      },
      {
        title: 'Outside your state: IGST',
        body: 'When you ship to another state, it is one tax called IGST, at the full rate. We pick the right one from the delivery address.',
      },
      {
        title: 'Prices including or excluding GST',
        body: 'Including GST means the price already has the tax inside it; the customer pays exactly that. Excluding GST means tax is added on top at checkout.',
      },
    ],
    exampleHeading: (rate: number) => `Example: a ₹1,000 item at ${rate}%`,
    included: 'Price includes GST',
    excluded: 'Price excludes GST',
    itemValue: 'Item value',
    gst: 'GST',
    customerPays: 'Customer pays',
    sameState: (cgst: string, sgst: string) => `Same state: CGST ${cgst} + SGST ${sgst}`,
    otherState: (full: string) => `Other state: IGST ${full}`,
    composition:
      'You are on the composition scheme, so none of this is charged. The customer pays the price you type.',
  },

  movedFromGeneral: {
    body: 'Taxes and GST now have their own page.',
    action: 'Open GST & invoices',
  },
} as const
