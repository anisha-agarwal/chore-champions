import { render, screen } from '@testing-library/react'
import { ChildComparisonChart } from '@/components/analytics/child-comparison-chart'
import type { ChildStats } from '@/lib/types'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ formatter }: { formatter?: (v: number | undefined) => [number, string] }) => {
    const formatted = formatter?.(5)
    const formattedUndef = formatter?.(undefined)
    return <div data-testid="tooltip" data-formatted={JSON.stringify(formatted)} data-formatted-undef={JSON.stringify(formattedUndef)} />
  },
  Legend: ({ formatter }: { formatter?: (v: string) => React.ReactNode }) => {
    const result = formatter?.('This Week')
    return <div data-testid="legend">{result}</div>
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function makeChild(overrides: Partial<ChildStats> & { name?: string; nickname?: string | null } = {}): ChildStats {
  return {
    profile: {
      id: overrides.name ?? 'child-1',
      display_name: overrides.name ?? 'Alice',
      nickname: overrides.nickname ?? null,
      avatar_url: null,
      points: 100,
    },
    completions_this_week: overrides.completions_this_week ?? 8,
    completions_last_week: overrides.completions_last_week ?? 5,
    completion_rate: overrides.completion_rate ?? 0.8,
  }
}

describe('ChildComparisonChart', () => {
  it('shows empty state when items array is empty', () => {
    render(<ChildComparisonChart items={[]} />)
    expect(screen.getByText('No children in the family yet.')).toBeInTheDocument()
  })

  it('does not render chart or table when empty', () => {
    render(<ChildComparisonChart items={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders with role="img" and correct aria-label', () => {
    render(<ChildComparisonChart items={[makeChild()]} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'aria-label',
      'Child comparison: 1 children, this week vs last week completions'
    )
  })

  it('renders sr-only table with caption', () => {
    render(<ChildComparisonChart items={[makeChild()]} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(screen.getByText('Child completion comparison this week vs last week')).toBeInTheDocument()
  })

  it('renders table headers: Child, This Week, Last Week', () => {
    render(<ChildComparisonChart items={[makeChild()]} />)
    expect(screen.getByRole('columnheader', { name: 'Child' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'This Week' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Last Week' })).toBeInTheDocument()
  })

  it('renders table data with display_name', () => {
    render(<ChildComparisonChart items={[makeChild({ name: 'Bob' })]} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('uses nickname as fallback when available', () => {
    render(
      <ChildComparisonChart
        items={[makeChild({ name: 'Robert', nickname: 'Bobby' })]}
      />
    )
    // nickname should appear in both chart data and sr-only table
    const cells = screen.getAllByText('Bobby')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to display_name when nickname is null', () => {
    render(
      <ChildComparisonChart
        items={[makeChild({ name: 'Alice', nickname: null })]}
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders multiple children in table', () => {
    const items = [
      makeChild({ name: 'Alice' }),
      makeChild({ name: 'Bob' }),
    ]
    // Need unique profile ids
    items[1].profile.id = 'child-2'
    render(<ChildComparisonChart items={items} />)
    const rows = screen.getAllByRole('row')
    // 1 header + 2 data rows
    expect(rows).toHaveLength(3)
  })

  it('renders completion counts in table', () => {
    render(
      <ChildComparisonChart
        items={[makeChild({ completions_this_week: 12, completions_last_week: 7 })]}
      />
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('updates aria-label count for multiple children', () => {
    const items = [makeChild({ name: 'A' }), makeChild({ name: 'B' })]
    items[1].profile.id = 'child-2'
    render(<ChildComparisonChart items={items} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('2 children')
  })
})
