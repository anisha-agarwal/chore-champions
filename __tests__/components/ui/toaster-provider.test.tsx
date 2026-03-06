import { render } from '@testing-library/react'
import { ToasterProvider } from '@/components/ui/toaster-provider'

jest.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="toaster" data-position={props.position} data-rich-colors={props.richColors ? 'true' : undefined} />
  ),
}))

describe('ToasterProvider', () => {
  it('renders Toaster with position top-center and richColors', () => {
    const { getByTestId } = render(<ToasterProvider />)
    const toaster = getByTestId('toaster')
    expect(toaster).toHaveAttribute('data-position', 'top-center')
    expect(toaster).toHaveAttribute('data-rich-colors', 'true')
  })
})
