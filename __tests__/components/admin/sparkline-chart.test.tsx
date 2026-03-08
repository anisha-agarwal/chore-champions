import { render, screen } from '@testing-library/react'

// Mock next/dynamic to return components synchronously (bypasses lazy loading in tests)
jest.mock('next/dynamic', () =>
  jest.fn((fn: () => Promise<unknown>) => {
    let Comp: React.ComponentType = () => null
    fn().then((mod) => {
      Comp = (mod as { default: React.ComponentType }).default
    })
    function DynamicWrapper(props: Record<string, unknown>) {
      const C = Comp
      return C ? <C {...props} /> : null
    }
    return DynamicWrapper
  })
)

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-line-chart">{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
}))

import { SparklineChart } from '@/components/admin/sparkline-chart'

describe('SparklineChart', () => {
  it('shows "No data" when data is empty', () => {
    render(<SparklineChart data={[]} dataKey="count" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('does not show "No data" when data is provided', () => {
    const data = [{ count: 5, time: '2025-01-01' }, { count: 10, time: '2025-01-02' }]
    render(<SparklineChart data={data} dataKey="count" />)
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('accepts custom color and height props without crashing', () => {
    const data = [{ count: 1 }]
    const { container } = render(<SparklineChart data={data} dataKey="count" color="#ff0000" height={80} />)
    expect(container).toBeInTheDocument()
  })
})
