import { render, screen, fireEvent } from '@testing-library/react'
import { HealthPanel } from '@/components/admin/health-panel'
import type { ObservabilitySummary } from '@/lib/types'

// Mock child components to simplify
jest.mock('@/components/admin/metric-card', () => ({
  MetricCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`metric-${label}`}>{label}: {value}</div>
  ),
}))

jest.mock('@/components/admin/sparkline-chart', () => ({
  SparklineChart: () => <div data-testid="sparkline" />,
}))

const mockSummary: ObservabilitySummary = {
  error_count: 3,
  prev_error_count: 1,
  active_users: 15,
  avg_latency_ms: 250,
  error_rate_trend: [{ time: '2025-01-01T00:00:00Z', count: 1 }],
  top_errors: [],
  route_latency: [],
}

const mockHealth = {
  supabase: 'ok' as const,
  logging_pipeline: 'ok' as const,
  timestamp: new Date().toISOString(),
}

describe('HealthPanel', () => {
  it('shows error state with retry button', () => {
    const onRetry = jest.fn()
    render(<HealthPanel summary={null} health={null} error="load failed" onRetry={onRetry} />)
    expect(screen.getByText(/Unable to load health data/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders metrics when data is present', () => {
    render(<HealthPanel summary={mockSummary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText(/Errors/)).toBeInTheDocument()
    expect(screen.getByText(/Active Users/)).toBeInTheDocument()
    expect(screen.getByText(/Avg Latency/)).toBeInTheDocument()
  })

  it('shows status indicators for supabase and logging', () => {
    render(<HealthPanel summary={mockSummary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText('Supabase')).toBeInTheDocument()
    expect(screen.getByText('Logging')).toBeInTheDocument()
  })

  it('renders sparkline when trend data exists', () => {
    render(<HealthPanel summary={mockSummary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByTestId('sparkline')).toBeInTheDocument()
  })

  it('handles null summary gracefully', () => {
    render(<HealthPanel summary={null} health={null} error={null} onRetry={jest.fn()} />)
    // Should render without crashing
    expect(screen.getByText('Health')).toBeInTheDocument()
  })

  it('shows down trend when error_count decreased', () => {
    const summary = { ...mockSummary, error_count: 0, prev_error_count: 5 }
    render(<HealthPanel summary={summary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText(/Errors/)).toBeInTheDocument()
  })

  it('highlights avg latency as yellow when over 1000ms', () => {
    const summary = { ...mockSummary, avg_latency_ms: 1500 }
    render(<HealthPanel summary={summary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText(/Avg Latency/)).toBeInTheDocument()
  })

  it('shows neutral trend when equal', () => {
    const summary = { ...mockSummary, error_count: 2, prev_error_count: 2 }
    render(<HealthPanel summary={summary} health={mockHealth} error={null} onRetry={jest.fn()} />)
    expect(screen.getByText(/Errors/)).toBeInTheDocument()
  })
})
