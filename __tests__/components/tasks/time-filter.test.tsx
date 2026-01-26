import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeFilter } from '@/components/tasks/time-filter'

describe('TimeFilter', () => {
  it('renders all filter options', () => {
    render(<TimeFilter selected="all" onChange={jest.fn()} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Anytime')).toBeInTheDocument()
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('Afternoon')).toBeInTheDocument()
    expect(screen.getByText('Night')).toBeInTheDocument()
  })

  it('highlights selected option', () => {
    render(<TimeFilter selected="morning" onChange={jest.fn()} />)

    const morningButton = screen.getByText('Morning')
    expect(morningButton).toHaveClass('bg-purple-600')
  })

  it('calls onChange when option clicked', async () => {
    const handleChange = jest.fn()
    render(<TimeFilter selected="all" onChange={handleChange} />)

    await userEvent.click(screen.getByText('Morning'))

    expect(handleChange).toHaveBeenCalledWith('morning')
  })

  it('does not highlight unselected options', () => {
    render(<TimeFilter selected="morning" onChange={jest.fn()} />)

    const allButton = screen.getByText('All')
    expect(allButton).not.toHaveClass('bg-purple-600')
    expect(allButton).toHaveClass('bg-white')
  })
})
