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
      { id: '#1043', name: 'Kabir Singh', total: '₹3,999', status: 'Paid' },
      { id: '#1042', name: 'Riya Sharma', total: '₹1,299', status: 'COD to confirm' },
      { id: '#1041', name: 'Arjun Mehta', total: '₹4,499', status: 'Shipped' },
      { id: '#1040', name: 'Neha Iyer', total: '₹2,590', status: 'Paid' },
      { id: '#1039', name: 'Sana Khan', total: '₹649', status: 'Delivered' },
    ],
  },
  products: {
    title: 'Products',
    columns: ['Product', 'Stock', 'Price'],
    rows: [
      { name: 'Abyss Veil Glasspad', stock: '3 left', price: '₹3,299', low: true },
      { name: 'Orbit XL Desk Mat', stock: '48', price: '₹2,499', low: false },
      { name: 'Nimbus Mouse Skates', stock: '2 left', price: '₹1,200', low: true },
      { name: 'Vector Keycap Set', stock: '19', price: '₹1,999', low: false },
      { name: 'Halo Wrist Rest', stock: '4 left', price: '₹899', low: true },
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
        a: '3 products are low: Abyss Veil Glasspad (3 left), Nimbus Mouse Skates (2 left) and Halo Wrist Rest (4 left). Want me to draft a purchase order? Nothing happens until you approve.',
      },
      {
        q: 'How did sales do today?',
        a: 'Sales today are ₹48,200 from 12 orders, up 18% on yesterday. UPI paid for 9 of them; 1 cash-on-delivery order still needs confirming.',
      },
      {
        q: 'Raise Glasspad prices by 5%',
        a: 'Here is the change: Abyss Veil ₹3,299 → ₹3,464, Orbit XL ₹2,499 → ₹2,624. Nothing is saved until you approve it.',
      },
    ],
  },
}
