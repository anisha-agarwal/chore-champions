import { render, screen } from '@testing-library/react'
import { StreakHeatmap } from '@/components/analytics/streak-heatmap'
import type { DailyPoint } from '@/lib/types'

describe('StreakHeatmap', () => {
  const today = new Date()
  const toIso = (daysAgo: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().slice(0, 10)
  }

  const sampleData: DailyPoint[] = [
    { date: toIso(1), points: 10, completions: 3 },
    { date: toIso(2), points: 5, completions: 1 },
    { date: toIso(10), points: 20, completions: 5 },
  ]

  it('renders with role="img" and accessible label including total completions', () => {
    render(<StreakHeatmap data={sampleData} />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('aria-label')).toMatch(/Activity heatmap:.*total completions/)
  })

  it('includes total completions count in label', () => {
    render(<StreakHeatmap data={sampleData} />)
    const img = screen.getByRole('img')
    // total = 3+1+5 = 9
    expect(img.getAttribute('aria-label')).toContain('9 total completions')
  })

  it('defaults to 52 weeks', () => {
    render(<StreakHeatmap data={sampleData} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('52 weeks')
  })

  it('respects custom weeks prop', () => {
    render(<StreakHeatmap data={sampleData} weeks={26} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('26 weeks')
  })

  it('renders sr-only summary paragraph', () => {
    render(<StreakHeatmap data={sampleData} />)
    const srText = screen.getByText(/Activity heatmap showing.*total quest completions/)
    expect(srText).toBeInTheDocument()
    expect(srText).toHaveClass('sr-only')
  })

  it('renders month labels', () => {
    render(<StreakHeatmap data={sampleData} />)
    // Should have at least one month label visible
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const found = monthLabels.some((m) => screen.queryByText(m) !== null)
    expect(found).toBe(true)
  })

  it('renders day labels (S, M, T, W, T, F, S) for even rows', () => {
    render(<StreakHeatmap data={sampleData} />)
    // Even indices show labels: S(0), T(2), T(4), S(6)
    expect(screen.getAllByText('S').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('T').length).toBeGreaterThanOrEqual(2)
  })

  it('renders legend with Less and More labels', () => {
    render(<StreakHeatmap data={sampleData} />)
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('renders SVG grid with aria-hidden', () => {
    const { container } = render(<StreakHeatmap data={sampleData} />)
    const svgs = container.querySelectorAll('svg')
    // The grid SVG should be aria-hidden
    const gridSvg = Array.from(svgs).find((s) => s.getAttribute('aria-hidden') === 'true')
    expect(gridSvg).toBeInTheDocument()
  })

  it('renders rect elements for grid cells', () => {
    const { container } = render(<StreakHeatmap data={sampleData} weeks={4} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('handles empty data array', () => {
    render(<StreakHeatmap data={[]} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('0 total completions')
  })

  it('renders legend color swatches matching HEATMAP_COLORS count', () => {
    const { container } = render(<StreakHeatmap data={sampleData} />)
    // Legend has 5 color swatches (HEATMAP_COLORS has 5 entries)
    const legendContainer = screen.getByText('Less').parentElement!
    const swatches = legendContainer.querySelectorAll('div[style]')
    expect(swatches).toHaveLength(5)
  })

  it('includes max completions in sr-only text', () => {
    render(<StreakHeatmap data={sampleData} />)
    // max completions = 5
    expect(screen.getByText(/Maximum 5 completions on any single day/)).toBeInTheDocument()
  })
})
