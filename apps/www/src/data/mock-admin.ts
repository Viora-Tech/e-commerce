import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name

export type MockTab = 'home' | 'orders' | 'products'

/** Sample data for the interactive admin mock. Not real data: the store and shoppers are made up. */
export const mockAdminContent = {
  url: `${siteConfig.brand.domain}/admin`,
  navLabel: 'Admin sections',
  store: 'Waimers',
  tabs: [
    { key: 'home', label: 'Home' },
    { key: 'orders', label: 'Orders' },
    { key: 'products', label: 'Products' },
  ] satisfies readonly { key: MockTab; label: string }[],
  home: {
    title: 'Home',
    stats: [
      { label: 'Sales today', value: '₹48,200' },
      { label: 'Orders', value: '12' },
      { label: 'Visitors', value: '340' },
    ],
    recent: 'Recent orders',
  },
  orders: {
    title: 'Orders',
    columns: ['Order', 'Customer', 'Total', 'Status'],
    rows: [
      { id: '#1043', name: 'Kabir Singh', total: '₹3,748', status: 'Paid' },
      { id: '#1042', name: 'Riya Sharma', total: '₹2,199', status: 'COD to confirm' },
      { id: '#1041', name: 'Arjun Mehta', total: '₹7,499', status: 'Shipped' },
      { id: '#1040', name: 'Neha Iyer', total: '₹2,590', status: 'Paid' },
      { id: '#1039', name: 'Sana Khan', total: '₹649', status: 'Delivered' },
    ],
  },
  products: {
    title: 'Products',
    columns: ['Product', 'Stock', 'Price'],
    rows: [
      { name: 'AbyssGaming Veil Glasspad', stock: '3 left', price: '₹7,499', low: true },
      { name: 'ATK A9 Wireless Mouse', stock: '48', price: '₹2,999', low: false },
      { name: 'TALONGAMES Dot Skates', stock: '2 left', price: '₹749', low: true },
      { name: 'ATK Knight MousePad', stock: '19', price: '₹2,199', low: false },
      { name: 'Lofree Hyzen67 Wrist Rest', stock: '4 left', price: '₹3,799', low: true },
    ],
  },
  ai: {
    label: `Ask ${brand} AI`,
    placeholder: 'Ask about your store…',
    send: 'Ask',
    hint: 'Sample answers only. Nothing here is real data.',
    questions: [
      {
        q: 'Which products are low on stock?',
        a: '3 products are low: AbyssGaming Veil Glasspad (3 left), TALONGAMES Dot Skates (2 left) and the Lofree Hyzen67 Wrist Rest (4 left). Want me to draft a purchase order? Nothing happens until you approve.',
      },
      {
        q: 'How did sales do today?',
        a: 'Sales today are ₹48,200 from 12 orders, up 18% on yesterday. UPI paid for 9 of them; 1 cash-on-delivery order still needs confirming.',
      },
      {
        q: 'Raise Glasspad prices by 5%',
        a: 'Here is the change: Veil Glasspad ₹7,499 → ₹7,874, Knight MousePad ₹2,199 → ₹2,309. Nothing is saved until you approve it.',
      },
    ],
  },
}
