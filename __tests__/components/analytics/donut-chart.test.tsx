import { render, screen } from '@testing-library/react'
import { DonutChart } from '@/components/analytics/donut-chart'
import type { ChildStats } from '@/lib/types'

jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: ({ formatter }: { formatter?: (v: number | undefined) => [string, string] }) => {
    const formatted = formatter?.(100)
    const formattedUndef = formatter?.(undefined)
    return <div data-testid="tooltip" data-formatted={JSON.stringify(formatted)} data-formatted-undef={JSON.stringify(formattedUndef)} />
  },
  Legend: ({ formatter }: { formatter?: (v: string) => React.ReactNode }) => {
    const result = formatter?.('Alice')
    return <div data-testid="legend">{result}</div>
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function makeChild(name: string, points: number, nickname: string | null = null): ChildStats {
  return {
    profile: {
      id: name,
      display_name: name,
      nickname,
      avatar_url: null,
      points,
    },
    completions_this_week: 5,
    completions_last_week: 3,
    completion_rate: 0.8,
  }
}

describe('DonutChart', () => {
  it('shows empty state when items array is empty', () => {
    render(<DonutChart items={[]} />)
    expect(screen.getByText('No points earned yet.')).toBeInTheDocument()
  })

  it('shows empty state when all children have zero points', () => {
    render(<DonutChart items={[makeChild('Alice', 0), makeChild('Bob', 0)]} />)
    expect(screen.getByText('No points earned yet.')).toBeInTheDocument()
  })

  it('filters out children with zero points', () => {
    render(<DonutChart items={[makeChild('Alice', 100), makeChild('Bob', 0)]} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', 'Points distribution among 1 children')
    // Bob should not be in the sr-only table
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('renders with role="img" and correct aria-label', () => {
    render(<DonutChart items={[makeChild('Alice', 100), makeChild('Bob', 200)]} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', 'Points distribution among 2 children')
  })

  it('renders sr-only table with caption', () => {
    render(<DonutChart items={[makeChild('Alice', 100)]} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(screen.getByText('Points distribution by child')).toBeInTheDocument()
  })

  it('renders table headers: Child, Points, Percentage', () => {
    render(<DonutChart items={[makeChild('Alice', 100)]} />)
    expect(screen.getByRole('columnheader', { name: 'Child' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Points' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Percentage' })).toBeInTheDocument()
  })

  it('renders correct percentage values', () => {
    render(<DonutChart items={[makeChild('Alice', 100), makeChild('Bob', 300)]} />)
    // Alice: 100/400 = 25%, Bob: 300/400 = 75%
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('uses nickname when available in table', () => {
    render(<DonutChart items={[makeChild('Robert', 100, 'Bobby')]} />)
    expect(screen.getByText('Bobby')).toBeInTheDocument()
    expect(screen.queryByText('Robert')).not.toBeInTheDocument()
  })

  it('falls back to display_name when nickname is null', () => {
    render(<DonutChart items={[makeChild('Alice', 100, null)]} />)
    // Appears in both legend (via formatter) and sr-only table
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
  })

  it('renders correct point values in table', () => {
    render(<DonutChart items={[makeChild('Alice', 150)]} />)
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('shows 100% for single child', () => {
    render(<DonutChart items={[makeChild('Alice', 50)]} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('does not render chart or table for empty state', () => {
    render(<DonutChart items={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders Recharts components when data exists', () => {
    render(<DonutChart items={[makeChild('Alice', 100)]} />)
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
  })
})
