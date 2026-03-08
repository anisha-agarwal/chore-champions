import { render, screen, fireEvent } from '@testing-library/react'
import { PerformancePanel } from '@/components/admin/performance-panel'
import type { PerformanceMetrics } from '@/lib/types'

jest.mock('@/components/admin/sparkline-chart', () => ({
  SparklineChart: () => <div data-testid="sparkline" />,
}))

const mockData: PerformanceMetrics = {
  route_latency: [
    { route: '/api/test', p95_ms: 200, avg_ms: 150, min_ms: 50, max_ms: 500, count: 100 },
    { route: '/api/slow', p95_ms: 1500, avg_ms: 1200, min_ms: 800, max_ms: 3000, count: 10 },
  ],
  rpc_timing: [
    { rpc_name: 'get_family_analytics', p95_ms: 300, avg_ms: 200, min_ms: 100, max_ms: 600, count: 50 },
    { rpc_name: 'get_user_streaks', p95_ms: 600, avg_ms: 400, min_ms: 200, max_ms: 1000, count: 30 },
  ],
  latency_trend: [{ time: '2025-01-01T00:00:00Z', avg_ms: 150 }],
}

describe('PerformancePanel', () => {
  it('shows error state with retry', () => {
    const onRetry = jest.fn()
    render(<PerformancePanel data={null} error="failed" onRetry={onRetry} />)
    expect(screen.getByText(/Unable to load performance data/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders route latency table', () => {
    render(<PerformancePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('/api/test')).toBeInTheDocument()
    expect(screen.getAllByText('200ms').length).toBeGreaterThan(0)
  })

  it('highlights high latency in yellow', () => {
    const { container } = render(<PerformancePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(container.querySelector('.text-yellow-400')).toBeInTheDocument()
  })

  it('renders RPC timing table', () => {
    render(<PerformancePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('get_family_analytics')).toBeInTheDocument()
  })

  it('shows Vercel Analytics link', () => {
    render(<PerformancePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Vercel Analytics')).toBeInTheDocument()
  })

  it('renders sparkline for latency trend', () => {
    render(<PerformancePanel data={mockData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByTestId('sparkline')).toBeInTheDocument()
  })

  it('shows "No performance data" when data is empty', () => {
    const emptyData: PerformanceMetrics = { route_latency: [], rpc_timing: [], latency_trend: [] }
    render(<PerformancePanel data={emptyData} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText(/No performance data/)).toBeInTheDocument()
  })

  it('handles null data gracefully', () => {
    render(<PerformancePanel data={null} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })
})
