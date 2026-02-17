import { render, screen, fireEvent } from '@testing-library/react'
import { WeekPicker } from '@/components/layout/week-picker'

describe('WeekPicker', () => {
  const mockOnDateSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Set a fixed system time - use explicit local time
    jest.setSystemTime(new Date(2024, 5, 12, 12, 0, 0)) // June 12, 2024 (Wednesday), noon local
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders all 7 day name labels', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('renders day numbers for the current week', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    // Week of June 9-15, 2024 (Sun-Sat)
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('shows month and year header', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument()
  })

  it('highlights selected date with purple-600 bg', () => {
    // selectedDate === today, isSelected is checked first in the ternary
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    const buttons = screen.getAllByRole('button')
    const day12Button = buttons.find((btn) => btn.textContent?.includes('12') && btn.textContent?.includes('Wed'))
    expect(day12Button).toHaveClass('bg-purple-600')
  })

  it('highlights today with purple-100 when not selected', () => {
    // Select a different day, today (12th) should get bg-purple-100
    render(<WeekPicker selectedDate={new Date(2024, 5, 10)} onDateSelect={mockOnDateSelect} />)

    const buttons = screen.getAllByRole('button')
    const todayButton = buttons.find((btn) => btn.textContent?.includes('12') && btn.textContent?.includes('Wed'))
    expect(todayButton).toHaveClass('bg-purple-100')
  })

  it('calls onDateSelect when a day is clicked', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    const buttons = screen.getAllByRole('button')
    const day10Button = buttons.find((btn) => btn.textContent?.includes('10') && btn.textContent?.includes('Mon'))
    fireEvent.click(day10Button!)

    expect(mockOnDateSelect).toHaveBeenCalledWith(expect.any(Date))
    const selectedDate = mockOnDateSelect.mock.calls[0][0]
    expect(selectedDate.getDate()).toBe(10)
  })

  it('navigates to previous week when left arrow is clicked', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    // First button is the prev-week arrow
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // Should now show June 2-8 (previous week)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('navigates to next week when right arrow is clicked', () => {
    render(<WeekPicker selectedDate={new Date(2024, 5, 12)} onDateSelect={mockOnDateSelect} />)

    // Second button is the next-week arrow
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])

    // Should now show June 16-22 (next week)
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })
})
