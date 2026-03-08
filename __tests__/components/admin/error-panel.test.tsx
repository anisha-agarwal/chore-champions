import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorPanel } from '@/components/admin/error-panel'
import type { ErrorListResult } from '@/lib/types'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/admin/error-table', () => ({
  ErrorTable: ({ errors }: { errors: unknown[] }) => (
    <div data-testid="error-table">{errors.length} errors</div>
  ),
}))

const mockData: ErrorListResult = {
  errors: [
    { id: 'e1', error_message: 'fail', error_type: 'api', error_code: null, route: '/api/test', method: 'GET', user_id: null, metadata: {}, created_at: new Date().toISOString() },
  ],
  total: 1,
  page: 1,
  total_pages: 1,
}

describe('ErrorPanel', () => {
  it('shows error state with retry', () => {
    const onRetry = jest.fn()
    render(<ErrorPanel data={null} error="failed" onPageChange={jest.fn()} onRetry={onRetry} />)
    expect(screen.getByText(/Unable to load error data/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders ErrorTable with errors', () => {
    render(<ErrorPanel data={mockData} error={null} onPageChange={jest.fn()} onRetry={jest.fn()} />)
    expect(screen.getByTestId('error-table')).toBeInTheDocument()
  })

  it('renders bar chart when errors exist', () => {
    render(<ErrorPanel data={mockData} error={null} onPageChange={jest.fn()} onRetry={jest.fn()} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders type filter buttons', () => {
    render(<ErrorPanel data={mockData} error={null} onPageChange={jest.fn()} onRetry={jest.fn()} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.getByText('rpc')).toBeInTheDocument()
  })

  it('switches type filter on click', () => {
    const onPageChange = jest.fn()
    render(<ErrorPanel data={mockData} error={null} onPageChange={onPageChange} onRetry={jest.fn()} />)
    fireEvent.click(screen.getByText('api'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('groups and sorts errors by route for bar chart', () => {
    const multiErrorData: ErrorListResult = {
      errors: [
        { id: 'e1', error_message: 'fail1', error_type: 'api', error_code: null, route: '/api/foo', method: 'GET', user_id: null, metadata: {}, created_at: new Date().toISOString() },
        { id: 'e2', error_message: 'fail2', error_type: 'rpc', error_code: null, route: '/api/bar', method: 'POST', user_id: null, metadata: {}, created_at: new Date().toISOString() },
        { id: 'e3', error_message: 'fail3', error_type: 'api', error_code: null, route: '/api/bar', method: 'GET', user_id: null, metadata: {}, created_at: new Date().toISOString() },
      ],
      total: 3,
      page: 1,
      total_pages: 1,
    }
    render(<ErrorPanel data={multiErrorData} error={null} onPageChange={jest.fn()} onRetry={jest.fn()} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('handles null data gracefully', () => {
    render(<ErrorPanel data={null} error={null} onPageChange={jest.fn()} onRetry={jest.fn()} />)
    expect(screen.getByText('0 errors')).toBeInTheDocument()
  })
})
