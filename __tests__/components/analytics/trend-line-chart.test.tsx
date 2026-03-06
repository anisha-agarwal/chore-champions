import { render, screen } from '@testing-library/react'
import { TrendLineChart } from '@/components/analytics/trend-line-chart'
import type { DailyPoint } from '@/lib/types'

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('TrendLineChart', () => {
  it('shows empty state when data is empty', () => {
    render(<TrendLineChart data={[]} />)
    expect(screen.getByText('No activity data in this period.')).toBeInTheDocument()
  })

  it('does not render chart or table when empty', () => {
    render(<TrendLineChart data={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('aggregates daily data into weekly data', () => {
    // Two days in same week (Mon & Tue of 2024-01-01 week)
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
      { date: '2024-01-02', points: 20, completions: 3 },
    ]
    render(<TrendLineChart data={data} />)
    // aggregateByWeek should combine into 1 week
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('1 weeks of data')
  })

  it('renders with default title in aria-label', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
    ]
    render(<TrendLineChart data={data} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('Family activity trend')
  })

  it('uses custom title', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
    ]
    render(<TrendLineChart data={data} title="Custom Trend" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Custom Trend')
    expect(screen.getByText('Custom Trend')).toBeInTheDocument()
  })

  it('renders sr-only table with weekly data', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
      { date: '2024-01-02', points: 20, completions: 3 },
    ]
    render(<TrendLineChart data={data} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
  })

  it('renders table headers: Week, Completions, Points', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
    ]
    render(<TrendLineChart data={data} />)
    expect(screen.getByRole('columnheader', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Completions' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Points' })).toBeInTheDocument()
  })

  it('shows aggregated totals in table', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
      { date: '2024-01-02', points: 20, completions: 3 },
    ]
    render(<TrendLineChart data={data} />)
    // Aggregated: points=30, completions=5
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders multiple weeks in separate rows', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
      { date: '2024-01-08', points: 20, completions: 3 },
    ]
    render(<TrendLineChart data={data} />)
    const rows = screen.getAllByRole('row')
    // 1 header + 2 data rows
    expect(rows).toHaveLength(3)
  })

  it('renders caption with title text', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 2 },
    ]
    render(<TrendLineChart data={data} />)
    expect(screen.getByText('Family activity trend')).toBeInTheDocument()
  })
})
