import { CheckIcon } from '@commerce/ui/icons'
import { Fragment } from 'react'
import { PLANS, pricingContent } from '@/data/pricing'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import JoinWaitlistButton from '../waitlist/join-waitlist-button'

const copy = pricingContent.page.compare

type CellProps = { value: string | boolean }

function Cell({ value }: CellProps) {
  if (value === true) {
    return (
      <>
        <CheckIcon aria-hidden className="mx-auto size-4 text-foreground" />
        <span className="sr-only">{copy.included}</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <span aria-hidden className="text-muted-foreground">
          —
        </span>
        <span className="sr-only">{copy.notIncluded}</span>
      </>
    )
  }
  return <span className="text-foreground">{value}</span>
}

export default function CompareTable() {
  return (
    <PageContainer as="section" className="flex flex-col items-center gap-10 py-20 md:py-28">
      <SectionHeading
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
        size="subsection"
      />
      <div className="w-full">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="sticky top-22 z-10">
              <th
                scope="col"
                className="glass-bar rounded-l-2xl px-2 py-3 md:px-5 md:py-4 font-normal text-muted-foreground"
              >
                <span className="mr-2">{copy.plan}</span>
                <span className="hidden rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground md:inline">
                  {copy.sticky}
                </span>
              </th>
              {PLANS.map((plan, index) => (
                <th
                  key={plan.key}
                  scope="col"
                  className={`glass-bar px-2 py-3 md:px-5 md:py-4 text-center font-medium text-foreground ${index === PLANS.length - 1 ? 'rounded-r-2xl' : ''}`}
                >
                  <span className="block md:mr-3 md:inline">{plan.name}</span>
                  <JoinWaitlistButton variant="outline" className="h-8 px-3 text-sm">
                    {pricingContent.joinShort}
                  </JoinWaitlistButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {copy.groups.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <th colSpan={4} scope="colgroup" className="px-2 pt-8 md:px-5 pb-2 text-left">
                    <span className="text-eyebrow">{group.title}</span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="border-t border-border px-2 py-3 md:px-5 md:py-4 font-normal text-foreground"
                    >
                      {row.label}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        key={PLANS[index]?.key ?? index}
                        className="border-t border-border px-2 py-3 md:px-5 md:py-4 text-center"
                      >
                        <Cell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  )
}
