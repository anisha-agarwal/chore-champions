import { render, screen } from '@testing-library/react'
import { CompletionBarChart } from '@/components/analytics/completion-bar-chart'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ formatter }: { formatter?: (v: number | undefined) => [number, string] }) => {
    const formatted = formatter?.(7)
    const formattedUndef = formatter?.(undefined)
    return <div data-testid="tooltip" data-formatted={JSON.stringify(formatted)} data-formatted-undef={JSON.stringify(formattedUndef)} />
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('CompletionBarChart', () => {
  it('renders with role="img" and correct aria-label', () => {
    render(<CompletionBarChart thisWeek={8} lastWeek={5} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'aria-label',
      'Week comparison: last week 5 completions, this week 8 completions'
    )
  })

  it('renders sr-only table with caption', () => {
    render(<CompletionBarChart thisWeek={8} lastWeek={5} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(screen.getByText('Week over week completions comparison')).toBeInTheDocument()
  })

  it('renders table with Week and Completions headers', () => {
    render(<CompletionBarChart thisWeek={8} lastWeek={5} />)
    expect(screen.getByRole('columnheader', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Completions' })).toBeInTheDocument()
  })

  it('renders Last Week and This Week data rows', () => {
    render(<CompletionBarChart thisWeek={8} lastWeek={5} />)
    expect(screen.getByText('Last Week')).toBeInTheDocument()
    expect(screen.getByText('This Week')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('has correct row count (header + 2 data rows)', () => {
    render(<CompletionBarChart thisWeek={8} lastWeek={5} />)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
  })

  it('handles zero values', () => {
    render(<CompletionBarChart thisWeek={0} lastWeek={0} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'aria-label',
      'Week comparison: last week 0 completions, this week 0 completions'
    )
  })

  it('renders Recharts components', () => {
    render(<CompletionBarChart thisWeek={3} lastWeek={7} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('tooltip formatter returns value and "Completions" label', () => {
    render(<CompletionBarChart thisWeek={3} lastWeek={7} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted')).toBe('[7,"Completions"]')
  })

  it('tooltip formatter returns 0 for undefined value', () => {
    render(<CompletionBarChart thisWeek={3} lastWeek={7} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted-undef')).toBe('[0,"Completions"]')
  })
})
