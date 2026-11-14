// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
const drawer = vi.fn()
vi.mock('./bulk-ship-drawer', () => ({
  default: (props: { orderIds: string[] }) => {
    drawer(props.orderIds)
    return null
  },
}))

const { default: CreateShipmentDialog } = await import('./create-shipment-dialog')

describe('CreateShipmentDialog (one surface per job)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('one order goes to its Create shipment page and closes', () => {
    const onClose = vi.fn()
    render(<CreateShipmentDialog orderIds={['o1']} onClose={onClose} onBooked={vi.fn()} />)
    expect(push).toHaveBeenCalledWith('/orders/o1/ship')
    expect(onClose).toHaveBeenCalled()
  })

  it("a courier app's one order keeps its courier", () => {
    render(
      <CreateShipmentDialog
        orderIds={['o1']}
        courier="delhivery"
        onClose={vi.fn()}
        onBooked={vi.fn()}
      />,
    )
    expect(push).toHaveBeenCalledWith('/orders/o1/ship?courier=delhivery')
  })

  it('several orders stay on the page and open the bulk drawer', () => {
    const onClose = vi.fn()
    render(<CreateShipmentDialog orderIds={['o1', 'o2']} onClose={onClose} onBooked={vi.fn()} />)
    expect(push).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(drawer).toHaveBeenCalledWith(['o1', 'o2'])
  })
})
