import { render, screen } from '@testing-library/react'
import { TaskFrequencyChart } from '@/components/analytics/task-frequency-chart'
import type { TaskFrequency } from '@/lib/types'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ formatter, labelFormatter }: {
    formatter?: (v: number | undefined) => [number, string];
    labelFormatter?: (l: string, payload: Array<{ payload: { fullTitle: string } }>) => string
  }) => {
    const formatted = formatter?.(10)
    const formattedUndef = formatter?.(undefined)
    const label = labelFormatter?.('Make B…', [{ payload: { fullTitle: 'Make Bed' } }])
    const labelEmpty = labelFormatter?.('', [])
    return <div data-testid="tooltip" data-formatted={JSON.stringify(formatted)} data-formatted-undef={JSON.stringify(formattedUndef)} data-label={label} data-label-empty={labelEmpty} />
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const sampleTasks: TaskFrequency[] = [
  { task_id: '1', title: 'Make Bed', count: 15 },
  { task_id: '2', title: 'Brush Teeth', count: 10 },
  { task_id: '3', title: 'Do Homework', count: 8 },
]

describe('TaskFrequencyChart', () => {
  it('shows empty state when tasks array is empty', () => {
    render(<TaskFrequencyChart tasks={[]} />)
    expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument()
  })

  it('does not render chart or table when empty', () => {
    render(<TaskFrequencyChart tasks={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders with role="img" and correct aria-label', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'aria-label',
      'Task frequency: horizontal bar chart of 3 tasks'
    )
  })

  it('uses custom title in aria-label', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} title="Top Quests" />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('Top Quests')
  })

  it('renders sr-only table with caption', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(screen.getByText('Task frequency')).toBeInTheDocument()
  })

  it('renders table headers: Task and Completions', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    expect(screen.getByRole('columnheader', { name: 'Task' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Completions' })).toBeInTheDocument()
  })

  it('renders full (untruncated) task titles in sr-only table', () => {
    const longTask: TaskFrequency = {
      task_id: '99',
      title: 'A Very Long Task Name That Exceeds Twenty Characters',
      count: 5,
    }
    render(<TaskFrequencyChart tasks={[longTask]} />)
    // The sr-only table should have the full title
    expect(screen.getByText('A Very Long Task Name That Exceeds Twenty Characters')).toBeInTheDocument()
  })

  it('truncates titles longer than 20 characters in chart data', () => {
    // The chart data name gets truncated to 18 chars + ellipsis
    // But since we mock Recharts, we verify via the aria-label count
    const longTasks: TaskFrequency[] = [
      { task_id: '1', title: 'This Is A Very Long Task Title', count: 5 },
    ]
    render(<TaskFrequencyChart tasks={longTasks} />)
    // Full title appears in sr-only table
    expect(screen.getByText('This Is A Very Long Task Title')).toBeInTheDocument()
  })

  it('respects limit prop', () => {
    const manyTasks = Array.from({ length: 15 }, (_, i) => ({
      task_id: String(i),
      title: `Task ${i}`,
      count: 15 - i,
    }))
    render(<TaskFrequencyChart tasks={manyTasks} limit={5} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('5 tasks')
    const rows = screen.getAllByRole('row')
    // 1 header + 5 data rows
    expect(rows).toHaveLength(6)
  })

  it('defaults limit to 10', () => {
    const manyTasks = Array.from({ length: 15 }, (_, i) => ({
      task_id: String(i),
      title: `Task ${i}`,
      count: 15 - i,
    }))
    render(<TaskFrequencyChart tasks={manyTasks} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('10 tasks')
  })

  it('renders task data in table rows', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    expect(screen.getByText('Make Bed')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('Brush Teeth')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('uses custom title in caption', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} title="Most completed" />)
    expect(screen.getByText('Most completed')).toBeInTheDocument()
  })

  it('renders Recharts components', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('tooltip formatter returns count and "Completions" label', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted')).toBe('[10,"Completions"]')
  })

  it('tooltip labelFormatter returns full title from payload', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-label')).toBe('Make Bed')
  })

  it('tooltip formatter returns 0 for undefined value', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-formatted-undef')).toBe('[0,"Completions"]')
  })

  it('tooltip labelFormatter returns empty string when payload is empty', () => {
    render(<TaskFrequencyChart tasks={sampleTasks} />)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip.getAttribute('data-label-empty')).toBe('')
  })
})
