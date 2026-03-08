import { render, screen, fireEvent } from '@testing-library/react'
import { UsagePanel } from '@/components/admin/usage-panel'
import type { UsageAnalytics } from '@/lib/types'

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockData: UsageAnalytics = {
  daily_active_users: [{ date: '2025-01-01', users: 10 }, { date: '2025-01-02', users: 15 }],
  top_chores: [{ task_name: 'Wash dishes', count: 20 }],
  least_chores: [{ task_name: 'Mow lawn', count: 2 }],
  peak_hours: [{ hour: 8, count: 50 }, { hour: 18, count: 80 }],
  ai_call_volume: [{ date: '2025-01-01', count: 5 }],
  event_counts: { task_completed: 100, page_view: 200, api_request: 500 },
}

describe('UsagePanel', () => {
  it('shows error state with retry', () => {
    const onRetry = jest.fn()
    render(<UsagePanel data={null} error="failed" onRetry={onRetry} />)
    expect(screen.getByText(/Unable to load usage data/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders DAU line chart section', () => {
    render(<UsagePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Daily Active Users')).toBeInTheDocument()
  })

  it('renders top and least chores charts', () => {
    render(<UsagePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Most Completed Chores')).toBeInTheDocument()
    expect(screen.getByText('Least Completed Chores')).toBeInTheDocument()
  })

  it('renders peak hours chart', () => {
    render(<UsagePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Peak Usage Hours (UTC)')).toBeInTheDocument()
  })

  it('renders AI call volume chart', () => {
    render(<UsagePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('AI API Calls (daily)')).toBeInTheDocument()
  })

  it('renders event counts table', () => {
    render(<UsagePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Event Counts')).toBeInTheDocument()
    expect(screen.getByText('task_completed')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('shows "No data" placeholders for empty arrays', () => {
    const emptyData: UsageAnalytics = {
      daily_active_users: [],
      top_chores: [],
      least_chores: [],
      peak_hours: [],
      ai_call_volume: [],
      event_counts: {},
    }
    render(<UsagePanel data={emptyData} error={null} onRetry={jest.fn()} />)
    const noDataElements = screen.getAllByText('No data')
    expect(noDataElements.length).toBeGreaterThan(0)
  })

  it('handles null data gracefully', () => {
    render(<UsagePanel data={null} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Usage')).toBeInTheDocument()
  })
})
