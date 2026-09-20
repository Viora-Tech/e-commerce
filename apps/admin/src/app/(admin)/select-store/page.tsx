import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SelectStore } from './select-store'

export default async function SelectStorePage() {
  const orgs = await auth().api.listOrganizations({ headers: await headers() })
  return <SelectStore stores={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))} />
}
