import { redirect } from 'next/navigation'

/**
 * `/account/orders`: the order list is the account's home page (`/account`). Shopify's new
 * customer accounts and many themes link here ("View all orders"), and it was a 404.
 */
export default function OrdersIndexPage() {
  redirect('/account')
}
