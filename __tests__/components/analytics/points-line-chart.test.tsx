import { render, screen } from '@testing-library/react'
import { PointsLineChart } from '@/components/analytics/points-line-chart'
import type { DailyPoint } from '@/lib/types'

// Mock Recharts — Tooltip mock calls formatter/labelFormatter to exercise coverage
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ formatter, labelFormatter }: { formatter?: (v: number | undefined) => [number, string]; labelFormatter?: (l: string) => string }) => {
    const formatted = formatter?.(42)
    const formattedUndef = formatter?.(undefined)
    const label = labelFormatter?.('01-15')
    return <div data-testid="tooltip" data-formatted={JSON.stringify(formatted)} data-formatted-undef={JSON.stringify(formattedUndef)} data-label={label} />
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const sampleData: DailyPoint[] = [
  { date: '2024-01-15', points: 10, completions: 2 },
  { date: '2024-01-16', points: 25, completions: 5 },
  { date: '2024-01-17', points: 5, completions: 1 },
]

describe('PointsLineChart', () => {
  it('renders with role="img" and accessible aria-label', () => {
    render(<PointsLineChart data={sampleData} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', 'Points over time: line chart showing 3 data points')
  })

  it('uses custom title in aria-label', () => {
    render(<PointsLineChart data={sampleData} title="My Points" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', 'My Points: line chart showing 3 data points')
  })

  it('renders sr-only table with caption', () => {
    render(<PointsLineChart data={sampleData} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(screen.getByText('Points over time')).toBeInTheDocument()
  })

  it('renders sr-only table with custom title caption', () => {
    render(<PointsLineChart data={sampleData} title="Custom Title" />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('renders table headers: Date, Points, Completions', () => {
    render(<PointsLineChart data={sampleData} />)
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Points' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Completions' })).toBeInTheDocument()
  })

  it('renders table rows with data', () => {
    render(<PointsLineChart data={sampleData} />)
    const rows = screen.getAllByRole('row')
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4)
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('renders all data points in table cells', () => {
    render(<PointsLineChart data={sampleData} />)
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
    expect(screen.getByText('2024-01-16')).toBeInTheDocument()
    expect(screen.getByText('2024-01-17')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('handles empty data array', () => {
    render(<PointsLineChart data={[]} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', 'Points over time: line chart showing 0 data points')
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(1) // header only
  })

  it('renders the Recharts components', () => {
    render(<PointsLineChart data={sampleData} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('tooltip formatter returns value and "Points" label', () => {
    render(<PointsLineChart data={sampleData} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted')).toBe('[42,"Points"]')
  })

  it('tooltip labelFormatter prefixes with "Date: "', () => {
    render(<PointsLineChart data={sampleData} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-label')).toBe('Date: 01-15')
  })

  it('tooltip formatter returns 0 for undefined value', () => {
    render(<PointsLineChart data={sampleData} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted-undef')).toBe('[0,"Points"]')
  })
})
