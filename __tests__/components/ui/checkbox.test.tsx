import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '@/components/ui/checkbox'

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox id="test" />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('can be checked', async () => {
    render(<Checkbox id="test" />)
    const checkbox = screen.getByRole('checkbox')

    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('renders with label', () => {
    render(<Checkbox id="test" label="Accept terms" />)
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument()
  })

  it('can be disabled', () => {
    render(<Checkbox id="test" disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('handles onChange', async () => {
    const handleChange = jest.fn()
    render(<Checkbox id="test" onChange={handleChange} />)

    await userEvent.click(screen.getByRole('checkbox'))
    expect(handleChange).toHaveBeenCalled()
  })

  it('can be controlled', () => {
    const { rerender } = render(<Checkbox id="test" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()

    rerender(<Checkbox id="test" checked={true} onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
