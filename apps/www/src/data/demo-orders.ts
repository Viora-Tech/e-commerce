/**
 * DEMO DATA. These pins and order chips on the marketing globe are made up for illustration:
 * no real orders, shoppers or amounts. Do not present them as live figures.
 */
export type DemoOrder = {
  id: string
  city: string
  lat: number
  lng: number
  amount: string
  method: string
}

export const DEMO_ORDERS: readonly DemoOrder[] = [
  { id: 'mumbai', city: 'Mumbai', lat: 19.076, lng: 72.8777, amount: '₹2,199', method: 'UPI' },
  { id: 'delhi', city: 'Delhi', lat: 28.6139, lng: 77.209, amount: '₹6,999', method: 'UPI' },
  {
    id: 'bengaluru',
    city: 'Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
    amount: '₹7,499',
    method: 'Card',
  },
  { id: 'jaipur', city: 'Jaipur', lat: 26.9124, lng: 75.7873, amount: '₹2,999', method: 'UPI' },
  { id: 'kolkata', city: 'Kolkata', lat: 22.5726, lng: 88.3639, amount: '₹899', method: 'COD' },
  { id: 'chennai', city: 'Chennai', lat: 13.0827, lng: 80.2707, amount: '₹3,799', method: 'UPI' },
  { id: 'pune', city: 'Pune', lat: 18.5204, lng: 73.8567, amount: '₹1,999', method: 'UPI' },
  {
    id: 'ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0225,
    lng: 72.5714,
    amount: '₹2,590',
    method: 'EMI',
  },
  { id: 'hyderabad', city: 'Hyderabad', lat: 17.385, lng: 78.4867, amount: '₹649', method: 'UPI' },
  { id: 'lucknow', city: 'Lucknow', lat: 26.8467, lng: 80.9462, amount: '₹749', method: 'COD' },
]

export const globeContent = {
  alt: 'A dotted globe centred on India',
  demoLabel: 'Demo orders',
  chipLabel: (order: DemoOrder) => `${order.amount} · ${order.method} · ${order.city}`,
}
