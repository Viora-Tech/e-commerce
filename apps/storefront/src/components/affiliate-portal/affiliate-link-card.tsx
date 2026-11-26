import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Separator } from '@commerce/ui/shadcn/separator'
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
 * Their affiliate link with Copy, "Get product link", "Get link with source", a QR code and share
 * buttons, and their discount code below, like UpPromote's dashboard card.
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
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CopyField value={link} label={copy.title} />
        <div className="flex flex-wrap gap-2">
          <ProductLinkDialog origin={origin} code={code} />
          <SourceLinkDialog origin={origin} code={code} />
          <QrDialog link={link} code={code} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{copy.share}</span>
          <ShareRow text={text} url={link} />
        </div>
        {couponCode ? (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{copy.coupon}</span>
              <CopyField value={couponCode} label={copy.coupon} />
              <p className="text-sm text-muted-foreground">{copy.couponHint(couponPercent)}</p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
