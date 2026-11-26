import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { referralLink } from '@/lib/portal-format'
import CopyField from './copy-field'
import ProductLinkDialog from './product-link-dialog'
import QrDialog from './qr-dialog'
import ShareRow from './share-row'
import SourceLinkDialog from './source-link-dialog'

type AffiliateLinkCardProps = {
  /** The store's own origin (its primary domain), where the link points. */
  origin: string
  code: string
  couponCode: string | null
  couponPercent: number | null
  couponSelected: boolean
}

const copy = affiliatePortalContent.dashboard.link

/**
 * Their affiliate link and discount code, each with Copy; the QR code in the header's corner;
 * "Get product link", "Get link with source" and one Share menu in the footer, which is pinned to
 * the bottom so it lines up with the Balance card beside it.
 */
export default function AffiliateLinkCard({
  origin,
  code,
  couponCode,
  couponPercent,
  couponSelected,
}: AffiliateLinkCardProps) {
  // Render logic
  const link = referralLink(origin, '/', code) ?? `${origin}/?ref=${code}`
  const text = affiliateContent.dashboard.share.message(
    link,
    couponCode,
    couponPercent,
    couponSelected,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{affiliateContent.dashboard.share.help}</CardDescription>
        <CardAction>
          <QrDialog link={link} code={code} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{copy.linkLabel}</span>
          <CopyField value={link} label={copy.title} />
        </div>
        {couponCode ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{copy.coupon}</span>
            <CopyField value={couponCode} label={copy.coupon} />
            <p className="text-sm text-muted-foreground">{copy.couponHint(couponPercent)}</p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="mt-auto min-h-20 flex-wrap gap-2">
        <ProductLinkDialog origin={origin} code={code} />
        <SourceLinkDialog origin={origin} code={code} />
        <div className="ml-auto">
          <ShareRow text={text} url={link} />
        </div>
      </CardFooter>
    </Card>
  )
}
