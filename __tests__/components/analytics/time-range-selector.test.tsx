import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeRangeSelector } from '@/components/analytics/time-range-selector'

describe('TimeRangeSelector', () => {
  it('renders three range buttons', () => {
    render(<TimeRangeSelector value={12} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: '4w' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12w' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '26w' })).toBeInTheDocument()
  })

  it('marks the selected range as aria-pressed', () => {
    render(<TimeRangeSelector value={4} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: '4w' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '12w' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '26w' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies active styling to selected button', () => {
    render(<TimeRangeSelector value={12} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: '12w' })).toHaveClass('bg-purple-600')
    expect(screen.getByRole('button', { name: '4w' })).toHaveClass('bg-gray-100')
  })

  it('calls onChange with the correct value when clicked', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()
    render(<TimeRangeSelector value={12} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '4w' }))
    expect(onChange).toHaveBeenCalledWith(4)

    await user.click(screen.getByRole('button', { name: '26w' }))
    expect(onChange).toHaveBeenCalledWith(26)
  })

  it('has a role="group" with accessible label', () => {
    render(<TimeRangeSelector value={12} onChange={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'Select time range' })).toBeInTheDocument()
  })

  it('updates aria-pressed when value prop changes', () => {
    const { rerender } = render(<TimeRangeSelector value={4} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: '4w' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<TimeRangeSelector value={26} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: '4w' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '26w' })).toHaveAttribute('aria-pressed', 'true')
  })
})
