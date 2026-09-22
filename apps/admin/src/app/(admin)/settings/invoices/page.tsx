import { redirect } from 'next/navigation'

/** Old address of the invoices settings; the GST invoices app owns them now. */
export default function Page() {
  redirect('/settings/apps/gst-invoices')
}
