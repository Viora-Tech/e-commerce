import { appStoreUrl } from '@commerce/config/site'
import { permanentRedirect } from 'next/navigation'

/**
 * The App Store moved out of the admin to its own website (owner decision, 2026-10-23): apps are
 * browsed there and installed through `/apps/install?app=<id>`. Old links land on the website.
 */
export default function Page() {
  permanentRedirect(appStoreUrl())
}
